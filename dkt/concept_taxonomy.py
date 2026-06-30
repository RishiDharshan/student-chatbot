"""
DKT — Concept Taxonomy Generator
=================================
Scans all User Info JSON files in example_io/ and extracts unique topic tags
from the ``qdata`` dictionary. Assigns each tag a stable integer Concept ID.

Usage:
    python -m dkt.concept_taxonomy            # Auto-scan example_io/
    python -m dkt.concept_taxonomy --dir /p    # Custom directory

Output:
    dkt/data/concept_taxonomy.json

Schema of qdata entries (Oliveboard format):
    "1001": [correctOption:int, sectionCode:str, topicName:str]

The taxonomy groups concepts by section for downstream analysis.
"""

from __future__ import annotations

import json
import os
import glob
import argparse
from typing import Dict, List, Tuple

# ── Constants ────────────────────────────────────────────────────────────────

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
TAXONOMY_FILE = os.path.join(DATA_DIR, "concept_taxonomy.json")

# Human-readable section names
SECTION_NAMES: Dict[str, str] = {
    "qa": "Quantitative Aptitude",
    "el": "English Language",
    "lr": "Logical Reasoning",
    "gk": "General Knowledge",
    "ga": "General Awareness",
}


# ── Core Functions ───────────────────────────────────────────────────────────

def extract_topics_from_file(filepath: str) -> List[Tuple[str, str]]:
    """
    Parse a single User Info JSON and extract (section_code, topic_name) pairs
    from the ``qdata`` dictionary.

    Returns:
        List of (section_code, topic_name) tuples.
    """
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    qdata = data.get("qdata", {})
    pairs: List[Tuple[str, str]] = []

    for _qid, qinfo in qdata.items():
        # qinfo = [correctOption, sectionCode, topicName]
        if not isinstance(qinfo, list) or len(qinfo) < 3:
            continue
        section_code = str(qinfo[1]).strip().lower()
        topic_name = str(qinfo[2]).strip()
        if topic_name:
            pairs.append((section_code, topic_name))

    return pairs


def build_taxonomy(input_dir: str) -> Dict:
    """
    Scan all ``User Info*.json`` files in *input_dir*, collect unique topics,
    and assign stable integer IDs (sorted alphabetically for determinism).

    Returns:
        {
            "num_concepts": int,
            "concepts": {
                "Simplification": {"id": 1, "section": "qa", "section_name": "Quantitative Aptitude"},
                ...
            },
            "id_to_concept": {"0": "__PAD__", "1": "Simplification", ...},
            "section_groups": {
                "qa": ["Simplification", "Number Series", ...],
                ...
            }
        }
    """
    # Collect all (section, topic) pairs across all files
    pattern = os.path.join(input_dir, "User Info*.json")
    files = glob.glob(pattern)
    if not files:
        raise FileNotFoundError(
            f"No 'User Info*.json' files found in {input_dir}. "
            f"Searched pattern: {pattern}"
        )

    print(f"[Taxonomy] Scanning {len(files)} file(s) in {input_dir}")

    all_pairs: set = set()
    for fp in files:
        pairs = extract_topics_from_file(fp)
        all_pairs.update(pairs)
        print(f"  → {os.path.basename(fp)}: {len(pairs)} question entries, "
              f"{len(set(p[1] for p in pairs))} unique topics")

    # Deduplicate and sort for deterministic IDs
    topic_to_section: Dict[str, str] = {}
    for section, topic in all_pairs:
        # If a topic appears in multiple sections, keep first encountered
        if topic not in topic_to_section:
            topic_to_section[topic] = section

    sorted_topics = sorted(topic_to_section.keys())

    # Build the taxonomy — ID 0 is reserved for padding
    concepts: Dict[str, Dict] = {}
    id_to_concept: Dict[str, str] = {"0": "__PAD__"}
    section_groups: Dict[str, List[str]] = {}

    for idx, topic in enumerate(sorted_topics, start=1):
        section = topic_to_section[topic]
        section_name = SECTION_NAMES.get(section, section.upper())

        concepts[topic] = {
            "id": idx,
            "section": section,
            "section_name": section_name,
        }
        id_to_concept[str(idx)] = topic

        if section not in section_groups:
            section_groups[section] = []
        section_groups[section].append(topic)

    taxonomy = {
        "num_concepts": len(sorted_topics),  # excludes padding
        "concepts": concepts,
        "id_to_concept": id_to_concept,
        "section_groups": section_groups,
    }

    print(f"\n[Taxonomy] Generated {len(sorted_topics)} concept IDs across "
          f"{len(section_groups)} sections")
    for sec, topics in sorted(section_groups.items()):
        sec_name = SECTION_NAMES.get(sec, sec.upper())
        print(f"  {sec_name} ({sec}): {len(topics)} concepts")

    return taxonomy


def save_taxonomy(taxonomy: Dict, output_path: str = TAXONOMY_FILE) -> str:
    """Write taxonomy to JSON and return the path."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(taxonomy, f, indent=2, ensure_ascii=False)
    print(f"\n[Taxonomy] Saved to {output_path}")
    return output_path


def load_taxonomy(path: str = TAXONOMY_FILE) -> Dict:
    """Load a previously generated taxonomy."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_concept_id(topic_name: str, taxonomy: Dict) -> int:
    """
    Look up the integer concept ID for a topic string.
    Returns 0 (padding/unknown) if not found.
    """
    entry = taxonomy["concepts"].get(topic_name)
    return entry["id"] if entry else 0


# ── CLI Entry Point ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate DKT concept taxonomy")
    parser.add_argument(
        "--dir",
        default=os.path.join(os.path.dirname(__file__), "..", "example_io"),
        help="Directory containing User Info JSON files",
    )
    parser.add_argument(
        "--output",
        default=TAXONOMY_FILE,
        help="Output path for concept_taxonomy.json",
    )
    args = parser.parse_args()

    taxonomy = build_taxonomy(os.path.abspath(args.dir))
    save_taxonomy(taxonomy, args.output)


if __name__ == "__main__":
    main()
