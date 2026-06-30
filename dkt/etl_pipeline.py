"""
DKT — ETL Pipeline
====================
Transforms raw Oliveboard User Info JSON files into LSTM-ready sequence data.

Pipeline Steps:
    1. Derive ``allquestion_attempts`` from ``testresponse`` + ``qdata``
    2. Sort interactions chronologically per user
    3. Map topic tags → concept IDs via taxonomy
    4. Compute per-concept time deltas (days_since_last_attempt)
    5. Pad/truncate sequences to fixed length N
    6. Export as NumPy arrays for training

Usage:
    python -m dkt.etl_pipeline
    python -m dkt.etl_pipeline --seq-len 100 --dir ./example_io

Output:
    dkt/data/training_sequences.npz
    dkt/data/user_states.json       (latest state per user for inference)
"""

from __future__ import annotations

import json
import os
import glob
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Any

import numpy as np
import pandas as pd

from .concept_taxonomy import (
    load_taxonomy,
    build_taxonomy,
    save_taxonomy,
    get_concept_id,
    TAXONOMY_FILE,
)

# ── Constants ────────────────────────────────────────────────────────────────

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
SEQUENCES_FILE = os.path.join(DATA_DIR, "training_sequences.npz")
USER_STATES_FILE = os.path.join(DATA_DIR, "user_states.json")
INTERACTION_DELTAS_FILE = os.path.join(DATA_DIR, "interaction_deltas.jsonl")

# Maximum time delta cap (days) — diminishing returns beyond this
MAX_DELTA_DAYS = 90.0

# Default sequence length for LSTM input
DEFAULT_SEQ_LEN = 100


# ── Step 1: Derive Interactions ──────────────────────────────────────────────

def _parse_time_segments(time_segments: List[Dict[str, str]]) -> float:
    """
    Calculate total time spent on a question from Oliveboard time segments.

    Each segment has {"st": "HH:MM:SS", "end": "HH:MM:SS"} where st is start
    (countdown from 20:00) and end is end. Time spent = st - end.

    Returns:
        Total seconds spent on the question.
    """
    total_seconds = 0.0
    for seg in time_segments:
        try:
            st = seg.get("st", "00:00:00")
            end = seg.get("end", "00:00:00")
            # Parse MM:SS or HH:MM:SS
            st_parts = st.split(":")
            end_parts = end.split(":")

            if len(st_parts) == 3:
                st_sec = int(st_parts[0]) * 3600 + int(st_parts[1]) * 60 + int(st_parts[2])
            else:
                st_sec = int(st_parts[0]) * 60 + int(st_parts[1])

            if len(end_parts) == 3:
                end_sec = int(end_parts[0]) * 3600 + int(end_parts[1]) * 60 + int(end_parts[2])
            else:
                end_sec = int(end_parts[0]) * 60 + int(end_parts[1])

            # In Oliveboard, timer counts DOWN: st > end means time spent = st - end
            spent = abs(st_sec - end_sec)
            total_seconds += spent
        except (ValueError, TypeError):
            continue

    return total_seconds


def derive_interactions(user_data: Dict[str, Any], taxonomy: Dict) -> pd.DataFrame:
    """
    Derive per-question interaction records from ``testresponse`` + ``qdata``.

    For each test result, for each question responded to:
      - Map question → topic via qdata
      - Compare user answer against correct answer
      - Calculate time taken from time segments
      - Record test timestamp

    Returns:
        DataFrame with columns:
            user_id, question_id, concept_id, concept_name,
            is_correct, time_taken_sec, timestamp, test_id
    """
    user_id = user_data.get("userid", user_data.get("username", "unknown"))
    qdata = user_data.get("qdata", {})
    results = user_data.get("results", [])

    interactions: List[Dict] = []

    for result in results:
        test_id = result.get("testid")
        test_timestamp = result.get("testtakenat", "")
        test_response = result.get("testresponse", {})

        # Parse the test timestamp
        try:
            ts = datetime.strptime(test_timestamp, "%Y-%m-%d %H:%M:%S")
        except (ValueError, TypeError):
            continue  # Skip tests with bad timestamps

        for qid, response in test_response.items():
            # Get question metadata from qdata
            q_info = qdata.get(qid)
            if not q_info or not isinstance(q_info, list) or len(q_info) < 3:
                continue

            correct_option = q_info[0]  # Integer: correct answer choice
            topic_name = str(q_info[2]).strip()

            # Get concept ID from taxonomy
            concept_id = get_concept_id(topic_name, taxonomy)
            if concept_id == 0:
                continue  # Unknown topic, skip

            # User's answer
            user_answer = response.get("o", "")

            # Determine correctness
            # Empty answer means unattempted
            if user_answer == "" or user_answer is None:
                is_correct = False
                attempted = False
            else:
                attempted = True
                try:
                    is_correct = int(user_answer) == int(correct_option)
                except (ValueError, TypeError):
                    is_correct = str(user_answer).strip() == str(correct_option).strip()

            # Calculate time taken
            time_segments = response.get("t", [])
            time_taken = _parse_time_segments(time_segments)

            # Only include attempted questions for the DKT sequence
            if not attempted:
                continue

            interactions.append({
                "user_id": str(user_id),
                "question_id": qid,
                "concept_id": concept_id,
                "concept_name": topic_name,
                "is_correct": int(is_correct),
                "time_taken_sec": round(time_taken, 1),
                "timestamp": ts,
                "test_id": test_id,
            })

    df = pd.DataFrame(interactions)
    if not df.empty:
        # Sort chronologically (by test timestamp, then question ID within test)
        df = df.sort_values(["timestamp", "question_id"]).reset_index(drop=True)

    return df


# ── Step 2: Compute Time Deltas ──────────────────────────────────────────────

def compute_time_deltas(df: pd.DataFrame) -> pd.DataFrame:
    """
    For each user × concept pair, compute ``days_since_last_attempt``
    using Pandas shift() grouped by (user_id, concept_id).

    Also computes normalized delta: Δt_norm = Δt / MAX_DELTA_DAYS, capped at 1.0.

    Modifies df in-place and returns it.
    """
    if df.empty:
        df["delta_days"] = []
        df["delta_norm"] = []
        return df

    # Sort by user, concept, then time
    df = df.sort_values(["user_id", "concept_id", "timestamp"]).reset_index(drop=True)

    # Compute time delta per (user, concept) group
    df["prev_timestamp"] = df.groupby(["user_id", "concept_id"])["timestamp"].shift(1)
    df["delta_days"] = (df["timestamp"] - df["prev_timestamp"]).dt.total_seconds() / 86400.0

    # First encounter per concept → delta = 0
    df["delta_days"] = df["delta_days"].fillna(0.0)

    # Cap at MAX_DELTA_DAYS
    df["delta_days"] = df["delta_days"].clip(upper=MAX_DELTA_DAYS)

    # Normalize to [0, 1]
    df["delta_norm"] = df["delta_days"] / MAX_DELTA_DAYS

    # Drop helper column
    df = df.drop(columns=["prev_timestamp"])

    # Re-sort chronologically per user for sequence building
    df = df.sort_values(["user_id", "timestamp", "question_id"]).reset_index(drop=True)

    return df


# ── Step 3: Build Sequences ─────────────────────────────────────────────────

def build_sequences(
    df: pd.DataFrame,
    num_concepts: int,
    seq_len: int = DEFAULT_SEQ_LEN,
) -> Dict[str, np.ndarray]:
    """
    Convert the interaction DataFrame into padded LSTM-ready sequences.

    For each user, builds a chronological sequence of interactions and formats:
        - interaction_id = concept_id * 2 + is_correct  (single integer for embedding)
        - delta_norm = normalized time delta
        - label = one-hot vector indicating which concept was tested + correctness

    Returns dict with numpy arrays:
        X_interactions: (num_users, seq_len)        — int IDs for embedding layer
        X_time:         (num_users, seq_len, 1)     — normalized Δt
        Y:              (num_users, seq_len, num_concepts) — target probabilities
        mask:           (num_users, seq_len)         — 1 where real, 0 where padded
        user_ids:       (num_users,)                — user ID strings
    """
    if df.empty:
        raise ValueError("No interaction data to build sequences from.")

    user_groups = df.groupby("user_id")
    num_users = len(user_groups)

    # Vocab size for interaction embedding: concept_id ∈ [0, num_concepts], * 2 for correct/wrong
    # +1 for padding token (index 0)
    vocab_size = (num_concepts + 1) * 2 + 1

    X_interactions = np.zeros((num_users, seq_len), dtype=np.int32)
    X_time = np.zeros((num_users, seq_len, 1), dtype=np.float32)
    Y = np.zeros((num_users, seq_len, num_concepts + 1), dtype=np.float32)
    mask = np.zeros((num_users, seq_len), dtype=np.float32)
    user_ids = []

    for user_idx, (uid, group) in enumerate(user_groups):
        user_ids.append(str(uid))
        interactions = group.to_dict("records")

        # Truncate if longer than seq_len (keep most recent)
        if len(interactions) > seq_len:
            interactions = interactions[-seq_len:]

        for t, interaction in enumerate(interactions):
            cid = interaction["concept_id"]
            correct = interaction["is_correct"]
            dt = interaction["delta_norm"]

            # Interaction ID: encodes both concept and correctness
            # concept_id * 2 + is_correct, offset by 1 to reserve 0 for padding
            interaction_id = cid * 2 + correct + 1
            X_interactions[user_idx, t] = interaction_id

            # Time delta
            X_time[user_idx, t, 0] = dt

            # Target: one-hot at the concept's index, value = is_correct
            # This teaches the model to predict recall probability per concept
            Y[user_idx, t, cid] = float(correct)

            # Mark as real (non-padded)
            mask[user_idx, t] = 1.0

    return {
        "X_interactions": X_interactions,
        "X_time": X_time,
        "Y": Y,
        "mask": mask,
        "user_ids": np.array(user_ids),
        "vocab_size": np.array([vocab_size]),
        "num_concepts": np.array([num_concepts + 1]),  # +1 for padding concept 0
        "seq_len": np.array([seq_len]),
    }


# ── Step 4: Extract User States ─────────────────────────────────────────────

def extract_user_states(df: pd.DataFrame, taxonomy: Dict) -> Dict:
    """
    Extract the latest state for each user — used for real-time inference.

    For each user, records:
        - Last interaction timestamp per concept
        - Last correctness per concept
        - Historical accuracy per concept
        - The full interaction sequence (last N)

    Returns:
        Dict keyed by user_id with state snapshots.
    """
    states = {}

    for uid, group in df.groupby("user_id"):
        user_state: Dict[str, Any] = {
            "user_id": str(uid),
            "last_updated": group["timestamp"].max().isoformat(),
            "total_interactions": len(group),
            "concepts": {},
        }

        for cid, cgroup in group.groupby("concept_id"):
            concept_name = taxonomy["id_to_concept"].get(str(cid), f"concept_{cid}")
            total = len(cgroup)
            correct = int(cgroup["is_correct"].sum())
            accuracy = round(correct / total * 100, 1) if total > 0 else 0.0
            last_ts = cgroup["timestamp"].max().isoformat()
            last_correct = int(cgroup.iloc[-1]["is_correct"])

            user_state["concepts"][str(cid)] = {
                "name": concept_name,
                "total_attempts": total,
                "correct": correct,
                "accuracy": accuracy,
                "last_timestamp": last_ts,
                "last_correct": last_correct,
            }

        states[str(uid)] = user_state

    return states


# ── Main Pipeline ────────────────────────────────────────────────────────────

def run_pipeline(
    input_dir: str,
    seq_len: int = DEFAULT_SEQ_LEN,
    taxonomy_path: Optional[str] = None,
) -> Dict[str, str]:
    """
    Execute the full ETL pipeline:
        1. Load/build taxonomy
        2. Parse all User Info JSONs
        3. Derive interactions
        4. Compute time deltas
        5. Build padded sequences
        6. Export .npz + user states

    Returns:
        Dict with output file paths.
    """
    print("=" * 60)
    print("DKT ETL Pipeline")
    print("=" * 60)

    # Step 0: Load or build taxonomy
    if taxonomy_path and os.path.exists(taxonomy_path):
        print(f"\n[ETL] Loading existing taxonomy from {taxonomy_path}")
        taxonomy = load_taxonomy(taxonomy_path)
    else:
        print(f"\n[ETL] Building taxonomy from {input_dir}")
        taxonomy = build_taxonomy(input_dir)
        save_taxonomy(taxonomy)
        taxonomy_path = TAXONOMY_FILE

    num_concepts = taxonomy["num_concepts"]
    print(f"[ETL] Taxonomy has {num_concepts} concepts")

    # Step 1: Parse all User Info files and derive interactions
    pattern = os.path.join(input_dir, "User Info*.json")
    files = glob.glob(pattern)
    print(f"\n[ETL] Processing {len(files)} user file(s)...")

    all_interactions: List[pd.DataFrame] = []
    for fp in files:
        with open(fp, "r", encoding="utf-8") as f:
            user_data = json.load(f)

        user_df = derive_interactions(user_data, taxonomy)
        if not user_df.empty:
            print(f"  → {os.path.basename(fp)}: {len(user_df)} interactions, "
                  f"user={user_df['user_id'].iloc[0]}")
            all_interactions.append(user_df)
        else:
            print(f"  → {os.path.basename(fp)}: No valid interactions found")

    if not all_interactions and not os.path.exists(INTERACTION_DELTAS_FILE):
        raise ValueError("No interactions derived from any file. Check data format.")

    df = pd.concat(all_interactions, ignore_index=True) if all_interactions else pd.DataFrame()
    
    # Step 1.5: Replay interaction deltas from booster quizzes
    if os.path.exists(INTERACTION_DELTAS_FILE):
        print(f"\n[ETL] Replaying delta log: {INTERACTION_DELTAS_FILE}")
        deltas = []
        with open(INTERACTION_DELTAS_FILE, "r") as f:
            for line in f:
                if line.strip():
                    deltas.append(json.loads(line))
        
        if deltas:
            delta_df = pd.DataFrame(deltas)
            # Ensure timestamp is datetime
            delta_df["timestamp"] = pd.to_datetime(delta_df["timestamp"])
            # Ensure matching schema
            delta_df["question_id"] = delta_df.index.astype(str) + "_delta"
            delta_df["test_id"] = "booster_quiz"
            
            df = pd.concat([df, delta_df], ignore_index=True)
            print(f"  → Appended {len(deltas)} interactions from delta log")
    print(f"\n[ETL] Total interactions: {len(df)} across {df['user_id'].nunique()} users")
    print(f"[ETL] Unique concepts seen: {df['concept_id'].nunique()}")
    print(f"[ETL] Date range: {df['timestamp'].min()} → {df['timestamp'].max()}")

    # Step 2: Compute time deltas
    print("\n[ETL] Computing per-concept time deltas...")
    df = compute_time_deltas(df)
    avg_delta = df[df["delta_days"] > 0]["delta_days"].mean()
    print(f"[ETL] Average inter-attempt gap: {avg_delta:.1f} days")

    # Step 3: Build sequences
    print(f"\n[ETL] Building padded sequences (seq_len={seq_len})...")
    sequences = build_sequences(df, num_concepts, seq_len)
    print(f"[ETL] Sequence shapes:")
    for key, arr in sequences.items():
        if isinstance(arr, np.ndarray):
            print(f"  {key}: {arr.shape} ({arr.dtype})")

    # Step 4: Extract user states for inference
    print("\n[ETL] Extracting per-user state snapshots...")
    user_states = extract_user_states(df, taxonomy)

    # Step 5: Save outputs
    os.makedirs(DATA_DIR, exist_ok=True)

    np.savez_compressed(SEQUENCES_FILE, **sequences)
    print(f"\n[ETL] Saved training sequences → {SEQUENCES_FILE}")

    with open(USER_STATES_FILE, "w", encoding="utf-8") as f:
        json.dump(user_states, f, indent=2, default=str)
    print(f"[ETL] Saved user states → {USER_STATES_FILE}")

    print("\n" + "=" * 60)
    print("ETL Pipeline Complete ✓")
    print("=" * 60)

    return {
        "sequences": SEQUENCES_FILE,
        "user_states": USER_STATES_FILE,
        "taxonomy": taxonomy_path,
    }


# ── CLI Entry Point ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="DKT ETL Pipeline")
    parser.add_argument(
        "--dir",
        default=os.path.join(os.path.dirname(__file__), "..", "example_io"),
        help="Directory containing User Info JSON files",
    )
    parser.add_argument(
        "--seq-len",
        type=int,
        default=DEFAULT_SEQ_LEN,
        help="Fixed sequence length for LSTM input (default: 100)",
    )
    parser.add_argument(
        "--taxonomy",
        default=None,
        help="Path to existing concept_taxonomy.json (auto-builds if missing)",
    )
    args = parser.parse_args()

    run_pipeline(
        input_dir=os.path.abspath(args.dir),
        seq_len=args.seq_len,
        taxonomy_path=args.taxonomy,
    )


if __name__ == "__main__":
    main()








