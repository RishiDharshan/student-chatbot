"""
DKT — Training Orchestrator
Loads ETL output, trains the DKT LSTM, exports Keras + TFLite models.
Usage: python -m dkt.train_dkt
"""
from __future__ import annotations
import json, os, argparse
from typing import Dict
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
SEQUENCES_FILE = os.path.join(DATA_DIR, "training_sequences.npz")
MODEL_FILE = os.path.join(DATA_DIR, "dkt_model.keras")
TFLITE_FILE = os.path.join(DATA_DIR, "dkt_model.tflite")
LOG_FILE = os.path.join(DATA_DIR, "training_log.json")

def train(epochs=50, batch_size=4, learning_rate=0.001, val_split=0.2, patience=10, lstm_units=128, embedding_dim=64) -> Dict:
    import tensorflow as tf
    from .dkt_lstm_model import build_dkt_model, MaskedBCELoss

    print("=" * 60 + "\nDKT Model Training\n" + "=" * 60)
    data = np.load(SEQUENCES_FILE, allow_pickle=True)
    X_int = data["X_interactions"]; X_t = data["X_time"]; Y = data["Y"]; mask = data["mask"]
    vs = int(data["vocab_size"][0]); nc = int(data["num_concepts"][0]); sl = int(data["seq_len"][0])
    uids = data["user_ids"]; n = len(X_int)
    print(f"[Train] {n} users, vocab={vs}, concepts={nc}, seq_len={sl}")

    model = build_dkt_model(vs, nc, sl, embedding_dim, lstm_units=lstm_units)
    model.summary()
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate), loss=MaskedBCELoss(), metrics=["accuracy"])

    cbs = [tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=patience, restore_best_weights=True, verbose=1),
           tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=5, min_lr=1e-6, verbose=1)]
    vs_actual = 0.0 if n < 3 else val_split
    if n < 3: cbs = []

    history = model.fit([X_int, X_t, mask], Y, epochs=epochs, batch_size=min(batch_size, n),
                        validation_split=vs_actual, callbacks=cbs, verbose=1)

    model.save(MODEL_FILE); print(f"[Train] Saved → {MODEL_FILE}")
    try:
        converter = tf.lite.TFLiteConverter.from_keras_model(model)
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.target_spec.supported_types = [tf.float16]
        with open(TFLITE_FILE, "wb") as f: f.write(converter.convert())
        print(f"[Train] TFLite → {TFLITE_FILE} ({os.path.getsize(TFLITE_FILE)/1024:.1f}KB)")
    except Exception as e:
        print(f"[Train] TFLite export skipped: {e}")

    log = {"epochs_trained": len(history.history["loss"]), "final_loss": float(history.history["loss"][-1]),
           "vocab_size": vs, "num_concepts": nc, "seq_len": sl, "lstm_units": lstm_units, "num_users": n,
           "loss_history": [float(x) for x in history.history["loss"]]}
    if "val_loss" in history.history: log["val_loss_history"] = [float(x) for x in history.history["val_loss"]]
    with open(LOG_FILE, "w") as f: json.dump(log, f, indent=2)
    print(f"Training Complete ✓  Final loss: {log['final_loss']:.4f}")
    return log

def main():
    p = argparse.ArgumentParser(); p.add_argument("--epochs", type=int, default=50)
    p.add_argument("--batch-size", type=int, default=4); p.add_argument("--lr", type=float, default=0.001)
    p.add_argument("--lstm-units", type=int, default=128); p.add_argument("--patience", type=int, default=10)
    a = p.parse_args(); train(a.epochs, a.batch_size, a.lr, patience=a.patience, lstm_units=a.lstm_units)

if __name__ == "__main__": main()


