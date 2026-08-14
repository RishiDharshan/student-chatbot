"""
OliveBot — RAG Knowledge Base
Indexes public_data.json using OpenAI embeddings into ChromaDB.
Provides fast semantic search to retrieve the closest exam/topic content chunk
for a user's query, grounding the AI's answer in verified data.
"""

import json
import os
import re
import threading
from html.parser import HTMLParser
from typing import Optional

# ── HTML Stripper ─────────────────────────────────────────────────────────────

class _HTMLStripper(HTMLParser):
    """Strip HTML tags and decode entities, preserving readable whitespace."""
    def __init__(self):
        super().__init__()
        self._parts = []

    def handle_data(self, data: str):
        stripped = data.strip()
        if stripped:
            self._parts.append(stripped)

    def get_text(self) -> str:
        return ' '.join(self._parts)


def strip_html(raw_html: str) -> str:
    """Remove all HTML tags and return clean plain text."""
    if not raw_html:
        return ''
    cleaned = re.sub(r'<(br|p|h[1-6]|li|tr|td|th)[^>]*>', ' ', raw_html, flags=re.IGNORECASE)
    parser = _HTMLStripper()
    try:
        parser.feed(cleaned)
        text = parser.get_text()
    except Exception:
        text = re.sub(r'<[^>]+>', ' ', raw_html)
    text = re.sub(r'\s{3,}', '  ', text)
    return text.strip()


# ── Module State ─────────────────────────────────────────────────────────────

_collection = None
_embedding_fn = None
_build_lock = threading.Lock()
_rag_ready = False
_rag_record_count = 0

RAG_TRIGGER_KEYWORDS = [
    'syllabus', 'salary', 'cut off', 'cutoff', 'notification',
    'exam pattern', 'eligibility', 'vacancy', 'vacancies',
    'selection process', 'admit card', 'result', 'answer key',
    'recruitment', 'preparation guide', 'how to prepare',
    'important dates', 'application form', 'registration',
]

SIMILARITY_THRESHOLD = 0.5  # Cosine distance threshold (1 - cos_sim). Lower is more strict.


# ── Index Builder ─────────────────────────────────────────────────────────────

def build_index(data_path: str) -> bool:
    global _collection, _embedding_fn, _rag_ready, _rag_record_count

    with _build_lock:
        if _rag_ready:
            return True

        print("[RAG] Starting knowledge base index build (using OpenAI embeddings)...")

        try:
            import chromadb
        except ImportError:
            print("[RAG] chromadb not installed — RAG disabled. Run: pip install chromadb")
            return False

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            print("[RAG] OPENAI_API_KEY not set — RAG disabled.")
            return False

        if not os.path.exists(data_path):
            print(f"[RAG] public_data.json not found at: {data_path}")
            return False

        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                raw = json.load(f)
        except Exception as e:
            print(f"[RAG] Failed to load data: {e}")
            return False

        ids, documents, metadatas = [], [], []
        for key, record in raw.items():
            exam = record.get('exam_name', '').strip()
            topic = record.get('topic', '').strip()
            content = record.get('content', '').strip()
            if not exam or not topic or not content:
                continue
            doc_text = f"{exam} {topic}"
            ids.append(str(key))
            documents.append(doc_text)
            metadatas.append({
                'exam_name': exam,
                'topic': topic,
                'content_clean': strip_html(content)[:4000],
            })

        if not ids:
            print("[RAG] No valid records found in data file.")
            return False

        try:
            from chromadb.utils import embedding_functions
            _embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
                api_key=api_key,
                model_name="text-embedding-3-small"
            )
        except Exception as e:
            print(f"[RAG] Failed to initialize OpenAI embedding function: {e}")
            return False

        client = chromadb.Client()
        _collection = client.create_collection(
            name="exam_knowledge",
            embedding_function=_embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )

        # Batch index in chunks of 100 (OpenAI API limit per request is 2048 inputs,
        # but keeping smaller batches avoids timeout issues on slow connections)
        BATCH = 100
        for i in range(0, len(ids), BATCH):
            _collection.add(
                ids=ids[i:i+BATCH],
                documents=documents[i:i+BATCH],
                metadatas=metadatas[i:i+BATCH],
            )
            print(f"[RAG] Indexed batch {i//BATCH + 1}/{(len(ids) + BATCH - 1)//BATCH}")

        _rag_record_count = len(ids)
        _rag_ready = True
        print(f"[RAG] Index built successfully: {_rag_record_count} records indexed.")
        return True


def build_index_background(data_path: str):
    """Launch build_index in a background thread so server startup is not blocked."""
    thread = threading.Thread(target=build_index, args=(data_path,), daemon=True)
    thread.start()


# ── Query ─────────────────────────────────────────────────────────────────────

def retrieve_top_match(query: str) -> Optional[dict]:
    if not _rag_ready or _collection is None:
        return None
    try:
        results = _collection.query(
            query_texts=[query],
            n_results=1,
            include=['metadatas', 'distances'],
        )
        if not results or not results['ids'] or not results['ids'][0]:
            return None
        distance = results['distances'][0][0]
        meta = results['metadatas'][0][0]
        print(f"[RAG Debug] Top match distance: {distance} for topic: {meta.get('topic')}")
        if distance > SIMILARITY_THRESHOLD:
            print(f"[RAG Debug] Rejected because {distance} > {SIMILARITY_THRESHOLD}")
            return None
        return {
            'exam_name': meta.get('exam_name', ''),
            'topic': meta.get('topic', ''),
            'content_clean': meta.get('content_clean', ''),
            'distance': round(distance, 4),
        }
    except Exception as e:
        print(f"[RAG] Query error: {e}")
        return None


# ── Trigger Detection ─────────────────────────────────────────────────────────

def should_trigger_rag(user_message: str) -> bool:
    lower = user_message.lower()
    return any(kw in lower for kw in RAG_TRIGGER_KEYWORDS)


# ── Grounding Prompt Builder ─────────────────────────────────────────────────

def build_rag_system_prompt(match: dict, user_message: str) -> str:
    return f"""You are OliveBot, an AI exam coaching assistant. The student has asked a general exam knowledge question.

You MUST answer using ONLY the following reference data from our verified knowledge base.
Do NOT use any outside knowledge, assumptions, or information not present in the data below.
If the data does not fully answer the question, honestly say: "I don't have complete information on that in my knowledge base."

--- EXAM REFERENCE DATA ---
Exam: {match['exam_name']}
Topic: {match['topic']}

{match['content_clean']}
--- END OF REFERENCE DATA ---

Student's Question: {user_message}

Answer clearly, concisely, and in a friendly coaching tone. Use bullet points or simple tables where appropriate."""


def build_no_match_system_prompt(user_message: str) -> str:
    return f"""You are OliveBot, an AI exam coaching assistant.

The student asked about an exam topic but no matching data was found in our knowledge base.
You MUST NOT answer from your own training data or hallucinate information.
Politely and honestly inform them that you don't have that specific exam's information available in your database, and suggest they check the official exam website.

Student's Question: {user_message}"""
