"""
DKT (Deep Knowledge Tracing) & Spaced Repetition Engine
========================================================
Predicts per-concept memory decay using an LSTM and triggers
proactive revision via gamified booster quizzes.

Modules:
    concept_taxonomy   — Maps string topic tags → integer concept IDs
    etl_pipeline       — Parses Oliveboard JSON → LSTM-ready sequences
    dkt_lstm_model     — Keras LSTM architecture for knowledge tracing
    train_dkt          — Training orchestrator
    inference          — TFLite / fallback inference utilities
    integration_service— Cron scheduler, trigger logic, booster generation
"""

__version__ = "0.1.0"
