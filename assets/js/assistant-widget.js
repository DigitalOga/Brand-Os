// ── PERSISTENT AI ASSISTANT WIDGET ─────────────────────────────────────────
// A small floating button, always available across the app (except while
// the auth/onboarding gate is up). Opens a lightweight chat panel that
// talks to ai-proxy.php's 'assistant' action, which builds its system
// prompt from this user's own profile — so replies are personalized
// without the widget itself holding any brand data client-side.

let _assistantHistory = [];
let _assistantMounted = false;
let _assistantOpen = false;

function mountAssistantWidget() {
  if (_assistantMounted) return;
  _assistantMounted = true;

  const btn = document.createElement('button');
  btn.id = 'assistant-fab';
  btn.setAttribute('aria-label', 'Open assistant');
  btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 00-7 7v3.5L3 17h5.2M12 2a7 7 0 017 7v3.5l2 4.5h-5.2M9 17a3 3 0 006 0"/></svg>`;
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'assistant-panel';
  panel.innerHTML = `
    <div style="padding:0.85rem 1rem;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
      <div style="font-weight:700;font-size:0.9rem;color:var(--text,#fff)">Your Brand OS Assistant</div>
      <button id="assistant-close" aria-label="Close" style="background:none;border:none;color:var(--text-muted,#9aa3b8);font-size:1.1rem;cursor:pointer;line-height:1;padding:0.25rem;">✕</button>
    </div>
    <div id="assistant-msgs" style="flex:1;overflow-y:auto;padding:0.85rem 1rem;display:flex;flex-direction:column;gap:0.6rem;font-size:0.85rem;"></div>
    <div style="padding:0.6rem;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:0.5rem;">
      <input id="assistant-input" type="text" placeholder="Ask me anything…" style="flex:1;padding:0.55rem 0.75rem;border-radius:9px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:var(--text,#fff);font-size:0.85rem;">
      <button id="assistant-send" style="border:none;border-radius:9px;background:var(--primary,#6467f2);color:#fff;padding:0 0.9rem;font-weight:600;cursor:pointer;">→</button>
    </div>`;
  document.body.appendChild(panel);

  const msgsEl  = panel.querySelector('#assistant-msgs');
  const inputEl = panel.querySelector('#assistant-input');
  const sendBtn = panel.querySelector('#assistant-send');

  function addBubble(role, text) {
    const b = document.createElement('div');
    const isUser = role === 'user';
    b.style.cssText = `max-width:85%;padding:0.5rem 0.75rem;border-radius:12px;line-height:1.4;white-space:pre-wrap;word-break:break-word;${isUser ? 'align-self:flex-end;background:var(--primary,#6467f2);color:#fff;' : 'align-self:flex-start;background:rgba(255,255,255,0.06);color:var(--text,#fff);'}`;
    b.textContent = text;
    msgsEl.appendChild(b);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return b;
  }

  function openPanel() {
    _assistantOpen = true;
    panel.classList.add('open');
    if (!msgsEl.children.length) {
      const name = (getUserProfile ? getUserProfile()?.name : null) || '';
      const firstName = name.split(' ')[0];
      addBubble('assistant', firstName
        ? `Hi ${firstName} — I'm your Brand OS assistant. Ask me about your content strategy, your voice, or how to use anything in here.`
        : `Hi — I'm your Brand OS assistant. Ask me anything about using the app or your content strategy.`);
    }
    setTimeout(() => inputEl.focus(), 50);
  }
  function closePanel() { _assistantOpen = false; panel.classList.remove('open'); }

  // Called from main.js while a full-screen sheet (Studio/Ask) is open, so
  // the floating chat launcher can never visually sit on top of it.
  window.hideAssistantWidget = function() {
    btn.classList.add('is-hidden');
    panel.classList.add('is-hidden');
  };
  window.showAssistantWidget = function() {
    btn.classList.remove('is-hidden');
    panel.classList.remove('is-hidden');
  };

  btn.addEventListener('click', () => _assistantOpen ? closePanel() : openPanel());
  panel.querySelector('#assistant-close').addEventListener('click', closePanel);

  async function send() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    addBubble('user', text);
    _assistantHistory.push({ role: 'user', content: text });
    sendBtn.disabled = true;
    const loadingBubble = addBubble('assistant', '…');
    const reply = await callAssistant(text, _assistantHistory);
    loadingBubble.textContent = reply;
    _assistantHistory.push({ role: 'assistant', content: reply });
    sendBtn.disabled = false;
  }
  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}
