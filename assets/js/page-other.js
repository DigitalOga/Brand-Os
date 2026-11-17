// ── PAGE: FEEDBACK ─────────────────────────────────────────────────────────
// Free users can run this — they just see a 3-line preview of the result,
// with the rest blurred, rather than being blocked from trying it at all.
function renderFeedback() {
  const S = STATE.feedback;
  const pro = isPro();
  const el = document.createElement('div');
  el.className = 'space-y-6';
  el.innerHTML = `
    <div class="page-heading"><h1>Feedback Insights</h1><p>Turn comments and messages into clear takeaways.</p></div>
    <div class="card">
      <div class="card-header"><div class="card-title">Input Data</div><div class="card-desc">Paste DMs, comments, or survey responses.</div></div>
      <div class="space-y-4">
        <div><label>Raw Feedback</label><textarea class="textarea mt-1" id="fb-data" placeholder="Paste comments here…" style="min-height:200px">${S.data}</textarea></div>
        <div><label>Optional Context</label><textarea class="textarea mt-1" id="fb-ctx" placeholder="e.g. From my recent post about scaling…" style="min-height:80px">${S.context}</textarea></div>
        <button id="fb-btn" class="btn btn-primary" ${!S.data.trim()?'disabled':''}>Extract Patterns</button>
        ${!pro ? `<p class="text-xs text-muted">Free preview shows the first few lines. <a href="#" id="fb-pro-link" style="color:var(--accent)">Go Pro</a> to see the full breakdown.</p>` : ''}
      </div>
    </div>
    <div id="fb-result">${S.result ? '' : ''}</div>`;

  el.querySelector('#fb-pro-link')?.addEventListener('click', (e) => { e.preventDefault(); navigate('subscription'); });
  el.querySelector('#fb-data').addEventListener('input', e => { S.data=e.target.value; el.querySelector('#fb-btn').disabled=!S.data.trim(); });
  el.querySelector('#fb-ctx').addEventListener('input',  e => S.context=e.target.value);

  function renderFeedbackResult(res) {
    const area = el.querySelector('#fb-result');
    area.innerHTML = '';
    if (pro) {
      area.appendChild(resultBox(res, 'Insights Breakdown'));
      area.querySelectorAll('.save-tracker-btn').forEach(btn => btn.addEventListener('click', () => showSaveModal(res)));
      area.querySelectorAll('.copy-btn').forEach(btn => btn.addEventListener('click', function(){ copyText(res, this); }));
    } else {
      const lines = res.split('\n').filter(l => l.trim());
      const visibleText = lines.slice(0, 3).join('\n');
      area.appendChild(renderBlurredPreview(res, {
        visibleText,
        teaseLine: 'The full pattern breakdown — pain points, what resonated, and next steps — is a Pro feature.',
        ctaLabel: 'Upgrade to Pro to see it all →'
      }));
    }
  }
  if (S.result) renderFeedbackResult(S.result);

  el.querySelector('#fb-btn').addEventListener('click', async () => {
    if (!checkGenLimit()) return;
    const btn=el.querySelector('#fb-btn');
    setLoading(btn, true, 'Extracting…');
    const prompt = `Task: Extract actionable insights from raw audience feedback.\n${S.context?`Context: ${S.context}`:''}\n\nRaw Feedback:\n"""\n${S.data}\n"""\n\nStructured breakdown:\n1. Core Pain Points\n2. What Resonated\n3. What Missed/Confused\n4. Actionable Next Steps`;
    const res = await callAI(prompt);
    setLoading(btn, false);
    if (res) { incrementDailyGen(); S.result=res; renderFeedbackResult(res); }
  });
  return el;
}

// ── PAGE: COACHING ─────────────────────────────────────────────────────────
// Available to Free users (limited to daily gen count), unlimited on Pro.
function renderCoaching() {
  const S = STATE.coaching;
  const el = document.createElement('div');
  el.className = 'space-y-4';
  el.style.cssText = 'display:flex;flex-direction:column;height:calc(100dvh - 140px);min-height:400px;';

  const genCount = getDailyGenCount();
  const limitReached = !isPro() && genCount >= FREE_LIMIT_AI;

  el.innerHTML = `
    <div class="page-heading" style="flex-shrink:0;margin-bottom:0">
      <h1>Coaching &amp; Strategy</h1>
      <p>Talk it through with your AI coach.</p>
    </div>
    ${!isPro() ? `<div class="free-limit-bar">
      ${icon('sparkles',12)}
      <span>You've used <strong>${genCount} of ${FREE_LIMIT_AI}</strong> free tries today.</span>
      <button class="btn btn-primary btn-sm" style="margin-left:auto;padding:0.2rem 0.75rem;font-size:0.75rem" id="coaching-upgrade-btn">Upgrade for unlimited</button>
    </div>` : ''}
    <div class="chat-wrap" style="flex:1">
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-footer">
        <div class="chat-input-row">
          <textarea class="input chat-textarea" id="chat-input"
            placeholder="${limitReached ? 'Daily limit reached — upgrade to Pro for unlimited coaching.' : 'Ask for strategy, feedback on an idea… (Enter to send, Shift+Enter for newline)'}"
            ${limitReached ? 'disabled' : ''}></textarea>
          <button id="chat-send" class="btn btn-primary btn-icon btn-lg" ${limitReached ? 'disabled' : ''}>${icon('send',18)}</button>
        </div>
      </div>
    </div>`;

  el.querySelector('#coaching-upgrade-btn')?.addEventListener('click', () => navigate('subscription'));

  const msgContainer = el.querySelector('#chat-messages');
  const chatInput    = el.querySelector('#chat-input');
  const sendBtn      = el.querySelector('#chat-send');

  function renderMessages() {
    msgContainer.innerHTML = S.messages.map(m => `
      <div class="msg msg-${m.role}">
        <div class="msg-avatar">${m.role==='ai'?icon('bot',16):icon('user',16)}</div>
        <div class="msg-bubble">${m.content}</div>
      </div>`).join('');
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
  renderMessages();

  async function sendMessage() {
    if (!checkGenLimit()) return;
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    S.messages.push({role:'user',content:text});
    renderMessages();
    const typing = document.createElement('div');
    typing.className = 'msg msg-ai';
    typing.innerHTML = `<div class="msg-avatar">${icon('bot',16)}</div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    msgContainer.appendChild(typing);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    sendBtn.disabled = true;
    const history = S.messages.slice(0,-1).map(m=>`${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const res = await callAI(`Conversation History:\n${history}\n\nUSER: ${text}\n\nRespond as this user's own AI brand advisor. Be concise and strategic.`);
    typing.remove();
    sendBtn.disabled = false;
    if (res) {
      incrementDailyGen();
      S.messages.push({role:'ai',content:res});
    } else {
      S.messages.push({role:'ai',content:'_Failed to respond. Please try again._'});
    }
    renderMessages();
    // Re-check limit after sending
    if (!isPro() && getDailyGenCount() >= FREE_LIMIT_AI) {
      chatInput.disabled = true;
      sendBtn.disabled = true;
      chatInput.placeholder = 'Daily limit reached — upgrade to Pro for unlimited coaching.';
    }
  }

  chatInput.addEventListener('keydown', e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  sendBtn.addEventListener('click', sendMessage);
  return el;
}

// ── PAGE: POSITIONING (formerly two separate destinations — Positioning
// Diagnostics + Signature Idea — merged into one, since both were really
// answering "what's the one true core message of my brand?" just via
// different inputs: paste a statement, or scan your own past posts. ──────
function renderPositioning() {
  const pro = isPro();
  const S = STATE.positioning;
  if (!S.mode) S.mode = 'check'; // 'check' (paste a statement) | 'find' (scan your posts)
  const el = document.createElement('div');
  el.className = 'space-y-6';

  function getSignature() { return STATE.signature || null; }
  function saveSignature(sig) { STATE.signature = sig; saveState(); }
  function getPostsForScan() {
    return (STATE.publish && STATE.publish.posts || [])
      .filter(p => p.content && p.content.trim().length > 50);
  }

  function renderSignatureCard() {
    const sig = getSignature();
    const card = el.querySelector('#sig-current');
    if (!card) return;

    if (!sig) {
      card.innerHTML = `
        <div style="text-align:center;padding:2rem 1rem;color:var(--muted-fg)">
          <div style="font-size:2rem;margin-bottom:0.75rem">💡</div>
          <p style="font-size:0.85rem;font-weight:600;margin-bottom:0.25rem">No Big Idea saved yet</p>
          <p style="font-size:0.78rem">Check your pitch below, or switch to "Find It From My Posts" to have the AI surface it from your own writing.</p>
        </div>`;
      return;
    }

    card.innerHTML = `
      <div style="border-left:3px solid var(--accent);padding-left:1rem">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:0.75rem">
          <div>
            <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted-fg);margin-bottom:0.25rem">Your Big Idea</div>
            <h3 style="font-size:1.1rem;margin:0;line-height:1.3">${escHtml(sig.name)}</h3>
          </div>
          <button class="btn btn-outline btn-sm" id="sig-clear-btn" style="flex-shrink:0">Clear</button>
        </div>
        <p style="font-size:0.85rem;line-height:1.65;color:var(--muted-fg)">${escHtml(sig.description)}</p>
        ${sig.tagline ? `<p style="font-size:0.8rem;font-style:italic;margin-top:0.5rem;color:var(--accent)">"${escHtml(sig.tagline)}"</p>` : ''}
      </div>
    `;

    card.querySelector('#sig-clear-btn')?.addEventListener('click', () => {
      showConfirmSheet({
        icon: '🗑️',
        title: 'Remove your Big Idea?',
        message: "The AI will stop using it in new posts.",
        confirmLabel: 'Yes, remove it',
        onConfirm: () => {
          saveSignature(null);
          renderSignatureCard();
          showToast('Big Idea cleared.');
        }
      });
    });
  }

  const posts = getPostsForScan();

  el.innerHTML = `
    <div class="page-heading"><h1>Positioning</h1><p>Find and sharpen the one big idea people remember about your brand.</p></div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Your Big Idea</div>
        <div class="card-desc">This gets added to everything the AI writes for you.</div>
      </div>
      <div id="sig-current"></div>
    </div>

    <div class="tabs-list">
      <button class="tab-btn ${S.mode==='check'?'active':''}" data-mode="check">Check My Pitch</button>
      <button class="tab-btn ${S.mode==='find'?'active':''}" data-mode="find">Find It From My Posts</button>
    </div>

    <div id="pos-check-pane" class="${S.mode==='check'?'':'hidden'}">
      ${pro ? `
      <div class="card">
        <div class="card-header"><div class="card-title">Positioning Input</div><div class="card-desc">Your current positioning or elevator pitch.</div></div>
        <div class="space-y-5">
          <div><label>Business Stage</label><select class="select-el mt-1" id="pos-stage">${BOTTLENECK_STAGES.map(s=>`<option value="${s.value}" ${S.stage===s.value?'selected':''}>${s.label}</option>`).join('')}</select></div>
          <div><label>Your Positioning Statement</label><textarea class="textarea mt-1" id="pos-draft" placeholder="Paste your current pitch, bio opener, or positioning…" style="min-height:140px">${S.draft}</textarea></div>
          <button id="pos-btn" class="btn btn-primary" ${!S.draft.trim()?'disabled':''}>Check My Pitch</button>
        </div>
      </div>
      <div id="pos-result" class="mt-6">${S.result?resultBox(S.result,'Diagnostic Result').outerHTML:''}</div>
      ` : `<div id="pos-paywall-slot"></div>`}
    </div>

    <div id="pos-find-pane" class="${S.mode==='find'?'':'hidden'}">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Scan Your Writing</div>
          <div class="card-desc">The AI reads your posted content and finds the one idea you keep coming back to.</div>
        </div>
        ${posts.length < 3 ? `
          <div style="text-align:center;padding:1.5rem;color:var(--muted-fg)">
            <p style="font-size:0.875rem">You need at least 3 posts in your Calendar's Tracker to run the scan.</p>
            <p style="font-size:0.8rem;margin-top:0.25rem">Currently found: <strong>${posts.length}</strong> posts.</p>
            <button class="btn btn-outline btn-sm mt-3" data-nav="publish" id="sig-go-publish">Go to your Calendar →</button>
          </div>
        ` : (!pro && STATE.usage.freeSignatureScanUsed) ? `
          <div style="text-align:center;padding:1.5rem;color:var(--muted-fg)">
            <p style="font-size:0.875rem">You've used your one free scan. Upgrade to Pro to rescan anytime your writing changes.</p>
            <button class="btn btn-primary btn-sm mt-3" id="sig-upgrade-btn">Upgrade to Pro →</button>
          </div>
        ` : `
          <div class="space-y-3">
            <p class="text-sm text-muted">Found <strong>${posts.length}</strong> posts to scan. The engine will look for recurring themes, metaphors, and the idea that keeps surfacing.${!pro ? ' <strong>Free plan: your first scan is on us.</strong>' : ''}</p>
            <button id="sig-scan-btn" class="btn btn-primary">Run Signature Scan</button>
          </div>
        `}
      </div>
      <div id="sig-result" class="mt-6"></div>
    </div>
  `;

  renderSignatureCard();
  if (!pro) el.querySelector('#pos-paywall-slot')?.appendChild(renderProPaywall('Positioning'));
  el.querySelector('#sig-upgrade-btn')?.addEventListener('click', () => navigate('subscription'));

  // ── Mode toggle ──────────────────────────────────────────────────────────
  el.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
    S.mode = btn.dataset.mode;
    el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b===btn));
    el.querySelector('#pos-check-pane').classList.toggle('hidden', S.mode!=='check');
    el.querySelector('#pos-find-pane').classList.toggle('hidden', S.mode!=='find');
  }));

  // ── Check My Pitch (existing Positioning Diagnostics flow — Pro only) ─────
  el.querySelector('#pos-stage')?.addEventListener('change', e => S.stage=e.target.value);
  el.querySelector('#pos-draft')?.addEventListener('input',  e => { S.draft=e.target.value; el.querySelector('#pos-btn').disabled=!S.draft.trim(); });
  el.querySelectorAll('.save-tracker-btn').forEach(btn => btn.addEventListener('click', () => showSaveModal(S.result)));
  el.querySelectorAll('.copy-btn').forEach(btn => btn.addEventListener('click', function() { copyText(S.result, this); }));

  el.querySelector('#pos-btn')?.addEventListener('click', async () => {
    if (!checkGenLimit()) return;
    const btn=el.querySelector('#pos-btn');
    setLoading(btn, true, 'Checking…');
    const prompt = `Task: Check this positioning statement.
Target Revenue Stage: ${S.stage}
Draft:
"""
${S.draft}
"""

Answer in plain, simple words a 12-year-old could follow — no jargon, no fancy business terms. Use these 3 headings exactly:
1. Does this fit? (Yes or no, and why, in one or two short sentences)
2. What's not working (the one biggest problem with it right now)
3. A better way to say it (rewrite it shorter, clearer, and stronger)`;
    const res = await callAI(prompt);
    setLoading(btn, false);
    if (res) { incrementDailyGen(); S.result=res; const area=el.querySelector('#pos-result'); area.innerHTML=''; area.appendChild(resultBox(res,'Diagnostic Result')); }
  });

  // ── Find It From My Posts (existing Signature scan flow) ──────────────────
  el.querySelector('#sig-go-publish')?.addEventListener('click', () => navigate('publish'));

  el.querySelector('#sig-scan-btn')?.addEventListener('click', async () => {
    if (!checkGenLimit()) return;
    const btn = el.querySelector('#sig-scan-btn');
    setLoading(btn, true, 'Scanning your writing…');

    const postSample = posts.slice(0, 15).map((p, i) =>
      `POST ${i+1}:\n"""\n${p.content.slice(0, 600)}\n"""`
    ).join('\n\n');

    const profile = getUserProfile();
    const prompt = `You are analysing ${profile?.name || 'this creator'}'s body of work to surface their Signature Idea — the ONE core concept, framework, or principle that keeps showing up across everything they write.

Here are their posts:

${postSample}

Your output — be specific and proprietary, not generic:

## SIGNATURE IDEA NAME
A short, memorable, ownable name (2-5 words). It should sound like something THEY invented.

## ONE-LINE DESCRIPTION
Exactly one sentence explaining the core idea — what it is and why it matters.

## TAGLINE
A punchy, memorable phrase in their voice that crystallises the idea.

## THE PATTERN
2–3 sentences on the recurring themes and signals you found across their posts that led you here.

## HOW TO USE IT
2–3 sentences on how they should deploy this idea across their content going forward.`;

    const res = await callAI(prompt);
    setLoading(btn, false);
    if (!res) return;

    incrementDailyGen();

    const getName  = () => (res.match(/##?\s*SIGNATURE IDEA NAME\s*\n([^\n]+)/i)||[])[1]?.trim() || 'Unnamed Framework';
    const getDesc  = () => (res.match(/##?\s*ONE-LINE DESCRIPTION\s*\n([^\n]+)/i)||[])[1]?.trim() || '';
    const getTag   = () => (res.match(/##?\s*TAGLINE\s*\n([^\n]+)/i)||[])[1]?.trim()?.replace(/^["']|["']$/g,'') || '';

    const resultArea = el.querySelector('#sig-result');
    resultArea.innerHTML = '';

    if (!pro) {
      // Free tier: this is their ONE scan. Show just the idea's name as a
      // real, genuine tease — everything else (description, tagline, the
      // pattern, how to use it) is blurred behind an upgrade card. No
      // save/rescan here — saving and rescanning are Pro capabilities.
      STATE.usage.freeSignatureScanUsed = true;
      saveState();
      const nameOnly = `Your Signature Idea: ${getName()}`;
      resultArea.appendChild(renderBlurredPreview(res, {
        visibleText: nameOnly,
        teaseLine: 'The full idea — description, tagline, and how to use it — is a Pro feature.',
        ctaLabel: 'Upgrade to Pro to unlock it →'
      }));
      return;
    }

    const resultCard = document.createElement('div');
    resultCard.className = 'card';
    resultCard.style.borderColor = 'var(--accent)';
    resultCard.innerHTML = `
      <div class="card-header">
        <div class="card-title">Scan Result</div>
        <div class="card-desc">Review and save your Big Idea if it resonates.</div>
      </div>
      <div class="result-box-body" style="white-space:pre-wrap;font-size:0.875rem;line-height:1.7;margin-bottom:1.25rem">${res.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      <div class="flex gap-3 flex-wrap">
        <button id="sig-save-btn" class="btn btn-primary">Save as My Big Idea</button>
        <button id="sig-rescan-btn" class="btn btn-outline">Rescan</button>
      </div>
    `;

    resultCard.querySelector('#sig-save-btn').addEventListener('click', () => {
      const sig = { name: getName(), description: getDesc(), tagline: getTag(), raw: res };
      saveSignature(sig);
      resultArea.innerHTML = '';
      renderSignatureCard();
      showToast('Big Idea saved — it\'s now part of every generation.');
    });

    resultCard.querySelector('#sig-rescan-btn').addEventListener('click', () => {
      el.querySelector('#sig-scan-btn')?.click();
    });

    resultArea.appendChild(resultCard);
  });

  return el;
}

// ── PAGE: OFFERS ───────────────────────────────────────────────────────────
function renderOffers() {
  // Pro-only feature
  if (!isPro()) return renderProPaywall('Offer Builder');

  const S = STATE.offers;
  const el = document.createElement('div');
  el.className = 'space-y-6';
  el.innerHTML = `
    <div class="page-heading"><h1>Offer Builder</h1><p>Build offers that solve your customer's biggest problem.</p></div>
    <div class="card">
      <div class="card-header"><div class="card-title">Offer Parameters</div><div class="card-desc">Who is this for, and what problem are they stuck with?</div></div>
      <div class="space-y-5">
        <div><label>Business Stage</label><select class="select-el mt-1" id="offer-stage">${BOTTLENECK_STAGES.map(s=>`<option value="${s.value}" ${S.stage===s.value?'selected':''}>${s.label}</option>`).join('')}</select></div>
        <div><label>What is their core problem?</label><input class="input mt-1" id="offer-problem" placeholder="e.g. They have leads but fulfillment is manual and exhausting…" value="${S.problem}"></div>
        <button id="offer-btn" class="btn btn-primary" ${!S.problem.trim()?'disabled':''}>Build Offer Frame</button>
      </div>
    </div>
    <div id="offer-result">${S.result?resultBox(S.result,'Offer Architecture').outerHTML:''}</div>`;

  el.querySelector('#offer-stage').addEventListener('change', e => S.stage=e.target.value);
  el.querySelector('#offer-problem').addEventListener('input', e => { S.problem=e.target.value; el.querySelector('#offer-btn').disabled=!S.problem.trim(); });
  el.querySelector('#offer-problem').addEventListener('keydown', e => { if(e.key==='Enter') el.querySelector('#offer-btn').click(); });
  el.querySelectorAll('.save-tracker-btn').forEach(btn => btn.addEventListener('click', () => showSaveModal(S.result)));
  el.querySelectorAll('.copy-btn').forEach(btn => btn.addEventListener('click', function() { copyText(S.result, this); }));

  el.querySelector('#offer-btn').addEventListener('click', async () => {
    if (!checkGenLimit()) return;
    const btn=el.querySelector('#offer-btn');
    setLoading(btn, true, 'Architecting…');
    const prompt = `Task: Build an Offer Frame.\nTarget Audience Stage: ${S.stage}\nCore Problem: ${S.problem}\n\n1. The Promise (1 clear sentence — the outcome, not the tool)\n2. The Mechanism (What infrastructure is being built?)\n3. Pricing Suggestion (Range and justification)\n4. Pitch Language (In this user's own voice — name THEIR bottleneck, one principle, proof/reframe with honest catch, the specific build + price as the door.)`;
    const res = await callAI(prompt);
    setLoading(btn, false);
    if (res) { incrementDailyGen(); S.result=res; const area=el.querySelector('#offer-result'); area.innerHTML=''; area.appendChild(resultBox(res,'Offer Architecture')); }
  });
  return el;
}
