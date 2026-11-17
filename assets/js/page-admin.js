// ── PAGE: ADMIN PANEL ─────────────────────────────────────────────────────
// Only accessible to users with is_admin = true in their profile.
// Manages: user roster, shared API keys, usage analytics.
// Access is plain email + password — there are no invite codes anywhere in
// the app. Admin status is granted by matching email in the database (see
// sql/09-remove-invites-admin-allowlist.sql), not by any code or invite.

function renderAdmin() {
  const profile = getUserProfile();
  const el = document.createElement('div');
  el.className = 'space-y-6';

  if (!profile || !profile.is_admin) {
    el.innerHTML = `
      <div class="page-heading"><h1>Admin Panel</h1></div>
      <div class="card" style="text-align:center;padding:3rem 2rem">
        <div style="font-size:2.5rem;margin-bottom:1rem">🔒</div>
        <p class="font-semibold">Access restricted</p>
        <p class="text-muted text-sm mt-1">This page is only available to admins.</p>
      </div>`;
    return el;
  }

  el.innerHTML = `
    <div class="page-heading">
      <h1>Admin Panel</h1>
      <p>See who's using Brand OS and manage the shared setup.</p>
    </div>

    <!-- STATS ROW -->
    <div class="grid-2" id="admin-stats">
      <div class="card" style="text-align:center;grid-column:1 / -1">
        <div id="stat-users" class="font-semibold" style="font-size:2rem">—</div>
        <div class="text-muted text-sm">Total users</div>
      </div>
    </div>

    <!-- SHARED API KEYS -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Shared API Keys</div>
        <div class="card-desc">One set of keys, used by every user. These live only in ai-proxy.php's key store on your server — never in Supabase, never sent to any user's browser.</div>
      </div>
      <div id="admin-keys-list" class="space-y-3">
        <div class="skeleton" style="height:2.5rem;margin-bottom:0.5rem"></div>
        <div class="skeleton" style="height:2.5rem;width:80%"></div>
      </div>
      <div id="admin-keys-error" class="auth-error" style="display:none;margin-top:0.75rem"></div>
      <button id="admin-keys-save" class="btn btn-primary btn-sm mt-3">Save Keys</button>
    </div>

    <!-- ANALYTICS -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Usage (last 14 days)</div>
        <div class="card-desc">AI generations and distinct active users per day.</div>
      </div>
      <div id="admin-analytics" style="display:flex;gap:3px;align-items:flex-end;height:90px;margin-top:0.5rem">
        <div class="skeleton" style="height:100%;width:100%"></div>
      </div>
      <div id="admin-analytics-totals" class="text-muted text-sm mt-2"></div>
    </div>

    <!-- USER ROSTER -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Users</div>
        <div class="card-desc">Everyone who has joined Brand OS.</div>
      </div>
      <div id="admin-users-list">
        <div class="skeleton" style="height:2.5rem;margin-bottom:0.5rem"></div>
        <div class="skeleton" style="height:2.5rem;margin-bottom:0.5rem;width:85%"></div>
      </div>
    </div>
  `;

  // ── Load users ────────────────────────────────────────────────────────────
  async function loadUsers() {
    const listEl = el.querySelector('#admin-users-list');
    const statEl = el.querySelector('#stat-users');
    try {
      const { data, error } = await SUPA.rpc('get_users_for_admin');
      if (error) throw error;
      if (statEl) {
        statEl.textContent = data.length;
        const labelEl = statEl.nextElementSibling;
        if (labelEl && data.length <= 1) {
          labelEl.textContent = "Just you so far — invite someone to join";
        } else if (labelEl) {
          labelEl.textContent = 'Total users';
        }
      }

      if (!data.length) {
        listEl.innerHTML = '<p class="text-muted text-sm">No users yet.</p>';
        return;
      }

      const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
      const isSelf = u => u.id === STATE.user?.session?.user?.id;

      listEl.innerHTML = `
        ${data.map(u => `
          <div class="admin-user-row" data-id="${u.id}" style="padding:0.75rem 0;border-bottom:1px solid var(--border-color)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap">
              <div style="min-width:0">
                <div class="font-semibold text-sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(u.name||'—')}</div>
                <div class="text-muted text-sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(u.email||'')} · joined ${fmtDate(u.created_at)}</div>
              </div>
              <div style="display:flex;gap:0.25rem;flex-wrap:wrap;align-items:center">
                ${u.onboarded ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-muted">Setup</span>'}
                ${u.is_admin  ? '<span class="badge badge-gold">Admin</span>' : ''}
                ${u.is_suspended ? '<span class="badge" style="background:var(--danger);color:#fff">Suspended</span>' : ''}
                ${u.is_pro ? `<span class="badge badge-success" title="${u.pro_expires_at ? 'Until '+fmtDate(u.pro_expires_at) : ''}">Pro</span>` : ''}
              </div>
            </div>
            ${isSelf(u) ? '' : `
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;align-items:center">
              <button class="btn btn-ghost btn-sm au-suspend" data-suspended="${u.is_suspended}">${u.is_suspended ? 'Unsuspend' : 'Suspend'}</button>
              <button class="btn btn-ghost btn-sm au-grant-pro">+30d Pro</button>
              <input type="number" min="0" class="input au-quota" style="width:80px" placeholder="${escHtml(String(u.daily_quota ?? ''))}" title="Daily AI quota (blank = default)">
              <button class="btn btn-ghost btn-sm au-save-quota">Set Quota</button>
              <button class="btn btn-ghost btn-sm au-delete" style="color:var(--danger);margin-left:auto">Delete</button>
            </div>`}
          </div>`).join('')}
      `;

      async function adminUsersCall(action, body) {
        const { data: { session } } = await SUPA.auth.getSession();
        const res = await fetch(`admin-users.php?action=${action}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify(body)
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || 'Request failed');
        return json;
      }

      listEl.querySelectorAll('.admin-user-row').forEach(row => {
        const id = row.dataset.id;
        row.querySelector('.au-suspend')?.addEventListener('click', async (e) => {
          const wasSuspended = e.target.dataset.suspended === 'true';
          e.target.disabled = true;
          try { await adminUsersCall('suspend', { user_id: id, suspended: !wasSuspended }); showToast(wasSuspended ? 'User unsuspended' : 'User suspended'); loadUsers(); }
          catch (err) { showToast(err.message, true); e.target.disabled = false; }
        });
        row.querySelector('.au-grant-pro')?.addEventListener('click', async (e) => {
          e.target.disabled = true;
          try { await adminUsersCall('grant_pro', { user_id: id, days: 30 }); showToast('Granted 30 days of Pro'); loadUsers(); }
          catch (err) { showToast(err.message, true); e.target.disabled = false; }
        });
        row.querySelector('.au-save-quota')?.addEventListener('click', async (e) => {
          const val = row.querySelector('.au-quota').value.trim();
          e.target.disabled = true;
          try { await adminUsersCall('set_quota', { user_id: id, daily_quota: val === '' ? null : val }); showToast('Quota updated'); loadUsers(); }
          catch (err) { showToast(err.message, true); e.target.disabled = false; }
        });
        row.querySelector('.au-delete')?.addEventListener('click', (e) => {
          showConfirmSheet({
            icon: '⚠️',
            title: 'Delete this user?',
            message: 'This cannot be undone. All of their posts, drafts, and settings will be gone for good.',
            confirmLabel: 'Yes, delete permanently',
            onConfirm: async () => {
              e.target.disabled = true;
              try { await adminUsersCall('delete', { user_id: id }); showToast('User deleted'); loadUsers(); }
              catch (err) { showToast(err.message, true); e.target.disabled = false; }
            }
          });
        });
      });
    } catch(e) {
      listEl.innerHTML = `<p class="text-muted text-sm">Failed to load users: ${e.message}<br><span style="font-size:0.75rem">Make sure you've run the schema.sql admin RPC function and set your account as admin.</span></p>`;
    }
  }

  // ── Shared API keys ───────────────────────────────────────────────────────
  const KEY_LABELS = {
    groq:'Groq', cerebras:'Cerebras', openrouter:'OpenRouter', mistral:'Mistral',
    anthropic:'Anthropic (Claude)', newsapi:'NewsAPI', youtube:'YouTube Data API'
  };
  async function adminKeysCall(action, opts = {}) {
    const { data: { session } } = await SUPA.auth.getSession();
    if (!session) throw new Error('Not signed in');
    const res = await fetch(`admin-keys.php${action === 'status' ? '?action=status' : ''}`, {
      method: opts.method || (action === 'status' ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {})
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function loadKeysPanel() {
    const listEl = el.querySelector('#admin-keys-list');
    try {
      const data = await adminKeysCall('status');
      listEl.innerHTML = Object.entries(KEY_LABELS).map(([id, label]) => {
        const info = data.keys[id] || { configured:false, preview:'' };
        return `
        <div class="key-group">
          <label>${label} ${info.configured ? `<span class="badge badge-success" style="margin-left:0.4rem">Set · ${info.preview}</span>` : `<span class="badge badge-muted" style="margin-left:0.4rem">Not set</span>`}</label>
          <input type="password" class="input mt-1 admin-key-input" data-id="${id}" placeholder="${info.configured ? 'Leave blank to keep current key' : `Paste ${label} key…`}">
        </div>`;
      }).join('');
    } catch(e) {
      listEl.innerHTML = errorState(`Couldn't load key status: ${e.message}`);
    }
  }

  el.querySelector('#admin-keys-save').addEventListener('click', async () => {
    const btn = el.querySelector('#admin-keys-save');
    const errEl = el.querySelector('#admin-keys-error');
    errEl.style.display = 'none';
    const updates = {};
    el.querySelectorAll('.admin-key-input').forEach(inp => {
      if (inp.value.trim()) updates[inp.dataset.id] = inp.value.trim();
    });
    if (!Object.keys(updates).length) { errEl.textContent = 'Paste at least one key to save.'; errEl.style.display = 'block'; return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await adminKeysCall('update', { method: 'POST', body: { updates } });
      showToast('Keys saved');
      await loadKeysPanel();
    } catch(e) {
      errEl.textContent = e.message || 'Failed to save keys.';
      errEl.style.display = 'block';
    }
    btn.disabled = false; btn.textContent = 'Save Keys';
  });

  // ── Analytics ─────────────────────────────────────────────────────────────
  async function loadAnalytics() {
    const chartEl  = el.querySelector('#admin-analytics');
    const totalsEl = el.querySelector('#admin-analytics-totals');
    try {
      const { data: { session } } = await SUPA.auth.getSession();
      const res = await fetch('admin-users.php?action=analytics', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to load');
      const days = json.days;
      const maxCalls = Math.max(1, ...days.map(d => d.calls));
      chartEl.innerHTML = days.map(d => {
        const h = Math.round((d.calls / maxCalls) * 100);
        return `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%" title="${d.day}: ${d.calls} calls, ${d.activeUsers} active">
          <div style="background:var(--primary,#6467f2);border-radius:2px;width:100%;height:${Math.max(2,h)}%"></div>
        </div>`;
      }).join('');
      const totalCalls = days.reduce((s,d) => s + d.calls, 0);
      const todayActive = days[days.length-1]?.activeUsers || 0;
      totalsEl.textContent = `${totalCalls} AI calls in the last 14 days · ${todayActive} active users today`;
    } catch(e) {
      chartEl.innerHTML = '';
      totalsEl.innerHTML = errorState(`Couldn't load analytics: ${e.message}`);
    }
  }

  // Load all in parallel
  loadUsers();
  loadKeysPanel();
  loadAnalytics();

  return el;
}
