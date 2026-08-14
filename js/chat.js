/**
 * OliveBot — Chat Controller
 * Handles sending messages, conversation history, typing indicators,
 * and communication with the backend API proxy.
 */

import { renderMessage } from './renderer.js';

/* ── State ───────────────────────────────────────────────── */

let conversationHistory = [];
let isWaiting = false;
let outOfScopeCount = 0;

/* ── Public API ──────────────────────────────────────────── */

export function resetConversation() {
  conversationHistory = [];
}

export async function sendChatMessage(text, systemPrompt) {
  if (isWaiting) return;

  appendUserMessage(text);

  isWaiting = true;
  setSendButtonState(true);
  showTypingIndicator();

  try {
    conversationHistory.push({ role: 'user', content: text });
    let reply = await callApi(systemPrompt);

    removeTypingIndicator();

    if (reply.includes("I'm your exam performance coach") || reply.includes("I can only help with your preparation")) {
      displayRejection(reply);
    } else {
      outOfScopeCount = 0;
      appendBotMessage(reply);
    }
    
    conversationHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
      conversationHistory.pop();
    }
    removeTypingIndicator();
    appendBotMessage(`⚠️ Error: ${err.message}`, true);
    console.error('[OliveBot] API error:', err);
  }

  isWaiting = false;
  setSendButtonState(false);
}

export function displayBotMessage(text) {
  appendBotMessage(text);
}

export function displayRejection(text) {
  outOfScopeCount++;
  if (outOfScopeCount >= 3) {
    const memeText = "I'm your exam performance coach — I can only help with your preparation, scores, study plans, and exam strategy.<br><br><img src=\"/assets/meme.png\" style=\"max-width: 100%; border-radius: 8px; margin-top: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);\"><br><br><i>Strictly exams only!</i>";
    appendBotMessage(memeText, true);
    outOfScopeCount = 0;
  } else {
    appendBotMessage(text, true);
  }
}

export function displayUserBubble(text) {
  appendUserMessage(text);
}

export async function sendSilentMessage(content, systemPrompt) {
  if (isWaiting) return;

  isWaiting = true;
  setSendButtonState(true);
  showTypingIndicator();

  try {
    conversationHistory.push({ role: 'user', content });
    const reply = await callApi(systemPrompt);

    removeTypingIndicator();
    appendBotMessage(reply);
    conversationHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
      conversationHistory.pop();
    }
    removeTypingIndicator();
    appendBotMessage(`⚠️ Error: ${err.message}`, true);
    console.error('[OliveBot] API error:', err);
  }

  isWaiting = false;
  setSendButtonState(false);
}

export function isBusy() {
  return isWaiting;
}

/* ── API Call ────────────────────────────────────────────── */

async function callApi(systemPrompt) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 3500,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
      ],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response. Please try again.';
}

/* ── DOM Manipulation ────────────────────────────────────── */

function appendUserMessage(text) {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `
    <div class="msg-body">
      <div class="msg-bubble">${escapeHtml(text)}</div>
    </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function appendBotMessage(text, isRejection = false) {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg bot';
  const bubbleClass = isRejection ? 'msg-bubble rejection' : 'msg-bubble';
  div.innerHTML = `
    <div class="msg-avatar bot">✧</div>
    <div class="msg-body">
      <div class="${bubbleClass}">${renderMessage(text)}</div>
    </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function showTypingIndicator() {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar bot">✧</div>
    <div class="msg-body">
      <div class="msg-bubble">
        <div class="typing"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

function setSendButtonState(disabled) {
  const btn = document.getElementById('send-btn');
  if (btn) btn.disabled = disabled;
}

function scrollToBottom() {
  const messages = document.getElementById('messages');
  // Need to use requestAnimationFrame to allow for DOM batching
  requestAnimationFrame(() => {
    messages.scrollTop = messages.scrollHeight;
  });
}

function escapeHtml(str) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
