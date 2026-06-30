"""
DKT — LSTM Model Architecture
===============================
Deep Knowledge Tracing model using a time-aware LSTM to predict
per-concept recall probability (memory decay).

Architecture:
    Input 1 (interactions): Embedding(vocab, 64) → (batch, seq, 64)
    Input 2 (time_delta):   Dense(16, relu)      → (batch, seq, 16)
    Concatenate → (batch, seq, 80)
    LSTM(128, return_sequences=True)
    Dropout(0.2)
    Dense(num_concepts, sigmoid) → P(recall) per concept

Loss: Masked Binary Crossentropy (ignoring padded timesteps)
Optimizer: Adam (lr=0.001)
"""

from __future__ import annotations

from typing import Optional, Tuple

import numpy as np

# ── TensorFlow Import (with graceful fallback) ───────────────────────────────

try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers, Model
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    tf = None
    keras = None
    layers = None
    Model = None


# ── Model Definition ─────────────────────────────────────────────────────────

def build_dkt_model(
    vocab_size: int,
    num_concepts: int,
    seq_len: int,
    embedding_dim: int = 64,
    time_dense_dim: int = 16,
    lstm_units: int = 128,
    dropout_rate: float = 0.2,
) -> "Model":
    """
    Build the DKT LSTM model.

    Args:
        vocab_size:     Size of interaction embedding vocabulary
                        (concept_id * 2 + is_correct, +1 for padding)
        num_concepts:   Total unique concepts (output dimension)
        seq_len:        Fixed sequence length
        embedding_dim:  Dimension of the interaction embedding
        time_dense_dim: Dense units for time delta processing
        lstm_units:     Number of LSTM hidden units
        dropout_rate:   Dropout rate after LSTM

    Returns:
        Compiled Keras Model
    """
    if not TF_AVAILABLE:
        raise ImportError(
            "TensorFlow is required to build the DKT model. "
            "Install with: pip install tensorflow>=2.15.0"
        )

    # ── Input 1: Interaction sequence (integer IDs)
    input_interactions = keras.Input(
        shape=(seq_len,),
        dtype=tf.int32,
        name="interaction_ids",
    )

    # ── Input 2: Time delta sequence (continuous)
    input_time = keras.Input(
        shape=(seq_len, 1),
        dtype=tf.float32,
        name="time_deltas",
    )

    # ── Input 3: Mask (for loss computation)
    input_mask = keras.Input(
        shape=(seq_len,),
        dtype=tf.float32,
        name="sequence_mask",
    )

    # ── Embedding layer for interactions
    # mask_zero=True ensures padded timesteps (ID=0) are handled
    embedded = layers.Embedding(
        input_dim=vocab_size,
        output_dim=embedding_dim,
        mask_zero=True,
        name="interaction_embedding",
    )(input_interactions)
    # Shape: (batch, seq_len, embedding_dim)

    # ── Time delta processing
    time_features = layers.Dense(
        time_dense_dim,
        activation="relu",
        name="time_dense",
    )(input_time)
    # Shape: (batch, seq_len, time_dense_dim)

    # ── Concatenate interaction embedding + time features
    concat = layers.Concatenate(name="concat_features")([embedded, time_features])
    # Shape: (batch, seq_len, embedding_dim + time_dense_dim)

    # ── The "Brain": LSTM layer
    # return_sequences=True so we get output at every timestep
    lstm_out = layers.LSTM(
        units=lstm_units,
        return_sequences=True,
        name="knowledge_state_lstm",
    )(concat)
    # Shape: (batch, seq_len, lstm_units)

    # ── Regularization
    dropped = layers.Dropout(dropout_rate, name="dropout")(lstm_out)

    # ── Output: sigmoid probability per concept
    output = layers.Dense(
        num_concepts,
        activation="sigmoid",
        name="concept_mastery",
    )(dropped)
    # Shape: (batch, seq_len, num_concepts)

    model = Model(
        inputs=[input_interactions, input_time, input_mask],
        outputs=output,
        name="DKT_LSTM",
    )

    return model


# ── Custom Masked Loss ───────────────────────────────────────────────────────

class MaskedBCELoss(tf.keras.losses.Loss if TF_AVAILABLE else object):
    """
    Binary Crossentropy loss that ignores padded timesteps.

    The mask tensor has value 1.0 for real interactions and 0.0 for padding.
    Loss is computed only on real timesteps to prevent the model from
    learning to predict on padding.
    """

    def __init__(self, name="masked_bce_loss"):
        if TF_AVAILABLE:
            super().__init__(name=name)

    def call(self, y_true, y_pred):
        # y_true shape: (batch, seq_len, num_concepts)
        # y_pred shape: (batch, seq_len, num_concepts)
        # We need the mask — it's passed through the model's third input
        # For simplicity, we compute loss on all non-zero targets

        # Clip predictions to prevent log(0)
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)

        # Binary crossentropy per element
        bce = -(y_true * tf.math.log(y_pred) + (1 - y_true) * tf.math.log(1 - y_pred))

        # Create mask: any timestep where y_true has at least one non-zero value
        # is a real interaction (padded rows are all-zero)
        timestep_mask = tf.reduce_max(tf.abs(y_true), axis=-1)  # (batch, seq)
        timestep_mask = tf.cast(timestep_mask > 0, tf.float32)

        # Average BCE across concepts, then apply mask
        bce_per_timestep = tf.reduce_mean(bce, axis=-1)  # (batch, seq)
        masked_loss = bce_per_timestep * timestep_mask

        # Average over non-padded timesteps
        total_real = tf.reduce_sum(timestep_mask) + 1e-8
        return tf.reduce_sum(masked_loss) / total_real


def create_mask_aware_loss(mask_tensor):
    """
    Factory function that creates a loss using the external mask tensor.
    This is used when the mask is a separate model input.
    """
    def masked_bce(y_true, y_pred):
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
        bce = -(y_true * tf.math.log(y_pred) + (1 - y_true) * tf.math.log(1 - y_pred))
        bce_per_timestep = tf.reduce_mean(bce, axis=-1)  # (batch, seq)

        # Use the explicit mask
        masked_loss = bce_per_timestep * mask_tensor
        total_real = tf.reduce_sum(mask_tensor) + 1e-8
        return tf.reduce_sum(masked_loss) / total_real

    return masked_bce


# ── Model Summary Helper ────────────────────────────────────────────────────

def print_model_summary(
    vocab_size: int = 100,
    num_concepts: int = 50,
    seq_len: int = 100,
):
    """Build and print the model summary for inspection."""
    if not TF_AVAILABLE:
        print("[DKT Model] TensorFlow not available. Cannot print summary.")
        return

    model = build_dkt_model(vocab_size, num_concepts, seq_len)
    model.summary()
    return model


if __name__ == "__main__":
    print_model_summary()
