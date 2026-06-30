"""
DKT — Integration Service
Cron scheduler, trigger logic, and booster quiz generation.
Connects the DKT model to the API layer.
"""
from __future__ import annotations
import json, os, random
from datetime import datetime
from typing import Dict, List, Optional

from .inference import predict_mastery, get_flagged_concepts, get_all_mastery_status, DEFAULT_THRESHOLD
from .concept_taxonomy import load_taxonomy, TAXONOMY_FILE

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
USER_STATES_FILE = os.path.join(DATA_DIR, "user_states.json")

# ── Booster Quiz Generation ──────────────────────────────────────────────────

# Map DKT concept names → mock-catalog.js question bank topic keys
CONCEPT_TO_QUIZ_TOPIC = {
    "Simplification": "Simplification", "Number Series": "Number Series",
    "Data Interpretation": "Data Interpretation", "Seating Arrangement": "Seating Arrangement",
    "Reading Comprehension": "Reading Comprehension", "Parajumbles": "Para-jumbles",
    "Cloze test": "Cloze Test", "Correct Usage": "Error Spotting",
    "Fill in the blanks": "Fill in the Blanks", "Syllogism": "Syllogism",
    "Inequalities": "Inequality", "Coding decoding": "Logical Reasoning",
    "Analytical reasoning": "Logical Reasoning", "Blood relations": "Blood Relations",
    "Grouping and Ordering": "Puzzles", "Direction Sense": "Logical Reasoning",
    "Puzzles": "Puzzles", "Bar Graphs": "Data Interpretation",
    "Line Graphs": "Data Interpretation", "Pie Charts": "Data Interpretation",
    "Tables": "Data Interpretation", "Datacomparision": "Data Interpretation",
    "Percentage Profit and Loss": "Quantitative", "Interest": "Quantitative",
    "Time and Work": "Quantitative", "Speed Time and Distance": "Quantitative",
    "Ratio and proportion": "Quantitative", "Averages and alligation": "Quantitative",
    "Number system": "Quantitative", "Mensuration": "Quantitative",
    "Partnerships": "Quantitative", "Comparison": "Quantitative",
    "NumberLetter": "Number Series", "Workpipescisterns": "Quantitative",
    "Sentence Joining": "Error Spotting", "Others": "Quantitative",
}

# Embedded mini question bank for booster quizzes (supplements mock-catalog.js)
BOOSTER_QUESTIONS = {
    "Simplification": [
        {"text": "What is 25% of 480 + 15% of 320?", "options": ["168", "172", "164", "176"], "correct": 0, "topic": "Simplification", "subtopic": "Percentage"},
        {"text": "√144 × √81 ÷ √36 = ?", "options": ["18", "16", "20", "22"], "correct": 0, "topic": "Simplification", "subtopic": "Roots"},
        {"text": "(3/5 of 250) - (2/7 of 140) = ?", "options": ["110", "108", "112", "106"], "correct": 0, "topic": "Simplification", "subtopic": "Fractions"},
    ],
    "Number Series": [
        {"text": "Find next: 7, 11, 19, 35, ?", "options": ["67", "59", "63", "71"], "correct": 0, "topic": "Number Series", "subtopic": "Pattern"},
        {"text": "Find next: 2, 5, 11, 23, 47, ?", "options": ["95", "93", "91", "97"], "correct": 0, "topic": "Number Series", "subtopic": "Doubling"},
    ],
    "Analytical reasoning": [
        {"text": "If A > B, B > C, and D > A, which is largest?", "options": ["A", "B", "C", "D"], "correct": 3, "topic": "Analytical reasoning", "subtopic": "Ordering"},
        {"text": "5 people in a row. X is 2nd from left. Y is 3rd from right. How many between them?", "options": ["0", "1", "2", "3"], "correct": 0, "topic": "Analytical reasoning", "subtopic": "Linear"},
    ],
    "Reading Comprehension": [
        {"text": "Passage: 'GDP growth slowed to 5.4% in Q2.' What is the main concern?", "options": ["Inflation", "Slowdown", "Employment", "Exports"], "correct": 1, "topic": "Reading Comprehension", "subtopic": "Main Idea"},
    ],
}


def generate_booster_quiz(user_id: str, question_count: int = 10, threshold: float = DEFAULT_THRESHOLD) -> Dict:
    """
    Generate a booster quiz targeting concepts below retention threshold.
    Returns a quiz payload compatible with the frontend quiz system.
    """
    flagged = get_flagged_concepts(user_id, threshold)
    if not flagged:
        return {"error": "No concepts below threshold", "quiz": None}

    # Collect questions targeting flagged concepts
    questions = []
    flagged_names = [f["name"] for f in flagged]

    for concept_name in flagged_names:
        # Try direct match in booster bank
        if concept_name in BOOSTER_QUESTIONS:
            questions.extend(BOOSTER_QUESTIONS[concept_name])
        # Try mapped topic
        mapped = CONCEPT_TO_QUIZ_TOPIC.get(concept_name)
        if mapped and mapped in BOOSTER_QUESTIONS:
            questions.extend(BOOSTER_QUESTIONS[mapped])

    # Deduplicate and shuffle
    seen = set()
    unique_qs = []
    for q in questions:
        key = q["text"][:50]
        if key not in seen:
            seen.add(key)
            unique_qs.append(q)
    random.shuffle(unique_qs)

    # Trim to question_count
    selected = unique_qs[:question_count]

    return {
        "quiz": {
            "name": f"Stamina Booster — {len(flagged)} Weak Concepts",
            "difficulty": "Adaptive",
            "question_count": len(selected),
            "target_concepts": flagged_names[:5],
            "questions": selected,
        },
        "flagged_concepts": flagged,
    }


# ── Delta Log: Process Quiz Results ──────────────────────────────────────────

INTERACTION_DELTAS_FILE = os.path.join(DATA_DIR, "interaction_deltas.jsonl")

def process_quiz_results(user_id: str, quiz_data: Dict) -> bool:
    """
    Process quiz results using the Delta Log pattern:
    1. Update in-memory user_states.json for instant Ebbinghaus updates.
    2. Append raw interactions to interaction_deltas.jsonl for future ETL.
    """
    if not os.path.exists(USER_STATES_FILE):
        return False
        
    with open(USER_STATES_FILE, "r") as f:
        all_states = json.load(f)
        
    user_state = all_states.get(user_id)
    if not user_state:
        return False

    taxonomy = load_taxonomy(TAXONOMY_FILE)
    name_to_id = {info["name"]: str(info["id"]) for cid, info in taxonomy.get("concepts", {}).items()}
    
    now_ts = datetime.now()
    now_iso = now_ts.isoformat()
    
    new_interactions = []
    
    for q in quiz_data.get("questions", []):
        topic_name = q.get("topic") or q.get("mapped_topic")
        is_correct = int(q.get("is_correct", 0))
        time_taken = float(q.get("time_taken", 30.0))
        
        concept_id_str = name_to_id.get(topic_name)
        if not concept_id_str:
            continue
            
        # 1. Update memory state
        concept_state = user_state.get("concepts", {}).get(concept_id_str)
        if concept_state:
            concept_state["total_attempts"] += 1
            concept_state["correct"] += is_correct
            concept_state["accuracy"] = round(concept_state["correct"] / concept_state["total_attempts"] * 100, 1)
            concept_state["last_timestamp"] = now_iso
            concept_state["last_correct"] = is_correct
        else:
            if "concepts" not in user_state:
                user_state["concepts"] = {}
            user_state["concepts"][concept_id_str] = {
                "name": topic_name,
                "total_attempts": 1,
                "correct": is_correct,
                "accuracy": 100.0 if is_correct else 0.0,
                "last_timestamp": now_iso,
                "last_correct": is_correct
            }
            
        user_state["total_interactions"] = user_state.get("total_interactions", 0) + 1
        user_state["last_updated"] = now_iso
        
        # 2. Prepare delta
        new_interactions.append({
            "user_id": user_id,
            "concept_id": int(concept_id_str),
            "concept_name": topic_name,
            "is_correct": is_correct,
            "time_taken_sec": time_taken,
            "timestamp": now_iso,
            "source": "booster_quiz"
        })
        
    # Write back memory state
    with open(USER_STATES_FILE, "w") as f:
        json.dump(all_states, f, indent=2, default=str)
        
    # Append to delta log
    if new_interactions:
        with open(INTERACTION_DELTAS_FILE, "a") as f:
            for interaction in new_interactions:
                f.write(json.dumps(interaction) + "\n")
                
    return True


# ── Cron: Nightly Mastery Refresh ────────────────────────────────────────────

def refresh_all_mastery(threshold: float = DEFAULT_THRESHOLD) -> Dict[str, List]:
    if not os.path.exists(USER_STATES_FILE):
        return {}

    with open(USER_STATES_FILE) as f:
        all_states = json.load(f)

    results = {}
    now = datetime.now()

    for user_id in all_states:
        flagged = get_flagged_concepts(user_id, threshold, now)
        results[user_id] = flagged
        if flagged:
            print(f"[Cron] User {user_id}: {len(flagged)} concepts below {threshold}")

    return results


def get_mastery_for_chatbot(user_id: str, threshold: float = DEFAULT_THRESHOLD) -> str:
    """
    Format mastery data as a text block for injection into the chatbot system prompt.
    """
    all_status = get_all_mastery_status(user_id)
    if not all_status:
        return ""

    flagged = [s for s in all_status if s["probability"] < threshold]
    if not flagged:
        return "\n## DKT MASTERY STATUS\nAll concepts above retention threshold. No urgent review needed."

    lines = ["\n## DKT MASTERY STATUS (Decaying Concepts — needs review)"]
    lines.append("| Concept | Retention | Status |")
    lines.append("|---------|-----------|--------|")
    for s in flagged:
        pct = round(s["probability"] * 100)
        emoji = "🔴" if s["status"] == "critical" else "⚠️"
        lines.append(f"| {s['name']} | {pct}% | {emoji} {s['status'].upper()} |")
    lines.append("\nProactively warn the student about these decaying topics and suggest the Training Hub.")
    return "\n".join(lines)
