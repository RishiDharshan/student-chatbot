"""
DKT — Inference Engine
Predicts per-concept mastery using trained LSTM or Ebbinghaus fallback.
Usage: from dkt.inference import predict_mastery, get_flagged_concepts
"""
from __future__ import annotations
import json, os, math
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MODEL_FILE = os.path.join(DATA_DIR, "dkt_model.keras")
TFLITE_FILE = os.path.join(DATA_DIR, "dkt_model.tflite")
LOG_FILE = os.path.join(DATA_DIR, "training_log.json")
USER_STATES_FILE = os.path.join(DATA_DIR, "user_states.json")
TAXONOMY_FILE = os.path.join(DATA_DIR, "concept_taxonomy.json")

DEFAULT_THRESHOLD = 0.75

# ── Ebbinghaus Fallback ──────────────────────────────────────────────────────

def ebbinghaus_recall(days_elapsed: float, stability: float = 7.0, accuracy: float = 0.5) -> float:
    """
    Ebbinghaus forgetting curve: P(t) = e^(-t/S)
    Stability S is modulated by historical accuracy:
      - High accuracy (>80%) → S * 2 (slower decay)
      - Low accuracy (<40%)  → S * 0.5 (faster decay)
    """
    if accuracy >= 0.8: stability *= 2.0
    elif accuracy >= 0.6: stability *= 1.5
    elif accuracy < 0.4: stability *= 0.5
    return math.exp(-days_elapsed / max(stability, 0.1))


def predict_mastery_ebbinghaus(user_state: Dict, now: Optional[datetime] = None) -> Dict[str, float]:
    """
    Fallback: predict mastery for all concepts using Ebbinghaus curve.
    Returns: { concept_id_str: probability }
    """
    if now is None: now = datetime.now()
    mastery = {}
    for cid, info in user_state.get("concepts", {}).items():
        try:
            last_ts = datetime.fromisoformat(info["last_timestamp"])
            days_elapsed = max(0, (now - last_ts).total_seconds() / 86400.0)
        except (ValueError, KeyError):
            days_elapsed = 30.0
        accuracy = info.get("accuracy", 50.0) / 100.0
        mastery[cid] = round(ebbinghaus_recall(days_elapsed, accuracy=accuracy), 4)
    return mastery


# ── LSTM Inference ───────────────────────────────────────────────────────────

class DKTPredictor:
    """Loads trained model and runs inference."""
    def __init__(self):
        self.model = None
        self.tflite_interpreter = None
        self.model_meta = None
        self._load_model()

    def _load_model(self):
        """Try TFLite first (lightweight), then full Keras."""
        if os.path.exists(TFLITE_FILE):
            try:
                import tflite_runtime.interpreter as tflite
                self.tflite_interpreter = tflite.Interpreter(model_path=TFLITE_FILE)
                self.tflite_interpreter.allocate_tensors()
                print("[DKT Inference] Loaded TFLite model")
            except ImportError:
                try:
                    import tensorflow as tf
                    self.tflite_interpreter = tf.lite.Interpreter(model_path=TFLITE_FILE)
                    self.tflite_interpreter.allocate_tensors()
                    print("[DKT Inference] Loaded TFLite model via TensorFlow")
                except Exception: pass

        if self.tflite_interpreter is None and os.path.exists(MODEL_FILE):
            try:
                import tensorflow as tf
                self.model = tf.keras.models.load_model(MODEL_FILE, compile=False)
                print("[DKT Inference] Loaded Keras model")
            except Exception as e:
                print(f"[DKT Inference] Could not load model: {e}")

        if os.path.exists(LOG_FILE):
            with open(LOG_FILE) as f: self.model_meta = json.load(f)

    @property
    def is_available(self) -> bool:
        return self.model is not None or self.tflite_interpreter is not None

    def predict(self, X_interactions: np.ndarray, X_time: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """Run forward pass. Returns (batch, seq_len, num_concepts) probabilities."""
        if self.tflite_interpreter:
            interp = self.tflite_interpreter
            input_details = interp.get_input_details()
            output_details = interp.get_output_details()
            # Resize if needed
            for i, inp in enumerate(input_details):
                interp.resize_tensor_input(inp["index"], [X_interactions, X_time, mask][i].shape)
            interp.allocate_tensors()
            interp.set_tensor(input_details[0]["index"], X_interactions.astype(np.int32))
            interp.set_tensor(input_details[1]["index"], X_time.astype(np.float32))
            interp.set_tensor(input_details[2]["index"], mask.astype(np.float32))
            interp.invoke()
            return interp.get_tensor(output_details[0]["index"])
        elif self.model:
            return self.model.predict([X_interactions, X_time, mask], verbose=0)
        else:
            raise RuntimeError("No model loaded")


# ── High-Level API ───────────────────────────────────────────────────────────

_predictor: Optional[DKTPredictor] = None

def _get_predictor() -> Optional[DKTPredictor]:
    global _predictor
    if _predictor is None:
        _predictor = DKTPredictor()
    return _predictor if _predictor.is_available else None


def predict_mastery(user_id: str, now: Optional[datetime] = None) -> Dict[str, float]:
    """
    Predict current mastery for all concepts for a user.
    Uses LSTM if available, falls back to Ebbinghaus.
    Returns: { concept_id: probability }
    """
    # Load user state
    if not os.path.exists(USER_STATES_FILE):
        return {}
    with open(USER_STATES_FILE) as f:
        all_states = json.load(f)
    user_state = all_states.get(user_id)
    if not user_state:
        return {}

    # Always compute Ebbinghaus as baseline/fallback
    mastery = predict_mastery_ebbinghaus(user_state, now)

    # Try LSTM prediction (future: integrate full sequence inference here)
    # For now, Ebbinghaus is the primary engine — LSTM enhances after training
    predictor = _get_predictor()
    if predictor and predictor.model_meta:
        # LSTM predictions would override Ebbinghaus for trained concepts
        # This is a placeholder for full sequence-based inference
        pass

    return mastery


def get_flagged_concepts(user_id: str, threshold: float = DEFAULT_THRESHOLD, now: Optional[datetime] = None) -> List[Dict]:
    """
    Get concepts below the retention threshold.
    Returns list of { concept_id, name, probability, accuracy } sorted by probability ascending.
    """
    mastery = predict_mastery(user_id, now)
    if not mastery: return []

    # Load taxonomy for names
    taxonomy = {}
    if os.path.exists(TAXONOMY_FILE):
        with open(TAXONOMY_FILE) as f: taxonomy = json.load(f)
    id_to_name = taxonomy.get("id_to_concept", {})

    flagged = []
    for cid, prob in mastery.items():
        if prob < threshold:
            flagged.append({
                "concept_id": int(cid),
                "name": id_to_name.get(cid, f"Concept {cid}"),
                "probability": prob,
                "status": "critical" if prob <= 0.5 else "decaying",
            })
    flagged.sort(key=lambda x: x["probability"])
    return flagged


def get_all_mastery_status(user_id: str, now: Optional[datetime] = None) -> List[Dict]:
    """
    Get mastery status for ALL concepts (not just flagged).
    Returns list of { concept_id, name, probability, status } sorted by name.
    """
    mastery = predict_mastery(user_id, now)
    if not mastery: return []

    taxonomy = {}
    if os.path.exists(TAXONOMY_FILE):
        with open(TAXONOMY_FILE) as f: taxonomy = json.load(f)
    id_to_name = taxonomy.get("id_to_concept", {})

    result = []
    for cid, prob in mastery.items():
        status = "mastered" if prob > 0.8 else "decaying" if prob > 0.5 else "critical"
        result.append({
            "concept_id": int(cid),
            "name": id_to_name.get(cid, f"Concept {cid}"),
            "probability": prob,
            "status": status,
        })
    result.sort(key=lambda x: x["name"])
    return result
