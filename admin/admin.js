'use strict';
const $ = (id) => document.getElementById(id);
const api = async (url, opts = {}) => {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (r.status === 401) { location.href = '/admin/login'; throw new Error('unauthorized'); }
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
};
const esc = (s) => (s == null ? '' : String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

let editingId = null;

// ---- bootstrap ----
(async () => {
  try {
    const me = await api('/api/me');
    $('whoName').textContent = me.name || me.email;
  } catch { return; }
  await refresh();
})();

// ---- data ----
async function refresh() {
  await Promise.all([loadStats(), loadMembers()]);
}
async function loadStats() {
  const s = await api('/api/stats');
  $('stTotal').textContent = s.total;
  $('stActive').textContent = s.active;
  $('stInactive').textContent = s.inactive;
  $('stOut').textContent = s.outstanding;
}
async function loadMembers() {
  const params = new URLSearchParams();
  const q = $('search').value.trim();
  if (q) params.set('search', q);
  if ($('fStatus').value !== 'all') params.set('status', $('fStatus').value);
  if ($('fPayment').value !== 'all') params.set('payment', $('fPayment').value);
  if ($('fDojo').value !== 'all') params.set('dojo', $('fDojo').value);
  const { members } = await api('/api/members?' + params.toString());
  renderRows(members);
  populateDojoFilter(members);
}
function renderRows(members) {
  const tb = $('rows');
  $('empty').classList.toggle('hidden', members.length > 0);
  $('countNote').textContent = members.length ? `Showing ${members.length} member${members.length === 1 ? '' : 's'}` : '';
  tb.innerHTML = members.map((m) => `
    <tr>
      <td><div class="m-name">${esc(m.full_name)}</div><div class="m-sub">${esc(m.email || m.phone || '')}</div></td>
      <td>${esc(m.dojo || '—')}</td>
      <td>${esc(m.rank || '—')}</td>
      <td>${esc(m.membership_type || '—')}</td>
      <td><span class="badge ${m.status}"><span class="bd"></span>${esc(cap(m.status))}</span></td>
      <td><span class="badge ${m.payment_status}"><span class="bd"></span>${esc(cap(m.payment_status))}</span></td>
      <td>${esc(m.expiry_date || '—')}</td>
      <td><div class="row-actions">
        <button class="icon-btn" title="Edit" data-edit="${m.id}"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
        <button class="icon-btn del" title="Delete" data-del="${m.id}" data-name="${esc(m.full_name)}"><svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
      </div></td>
    </tr>`).join('');
}
let dojoFilled = false;
function populateDojoFilter(members) {
  if (dojoFilled) return;
  const set = [...new Set(members.map((m) => m.dojo).filter(Boolean))].sort();
  if (!set.length) return;
  const sel = $('fDojo');
  set.forEach((d) => { const o = document.createElement('option'); o.value = d; o.textContent = d; sel.appendChild(o); });
  dojoFilled = true;
}

// ---- filters ----
let searchTimer;
$('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadMembers, 250); });
['fStatus', 'fPayment', 'fDojo'].forEach((id) => $(id).addEventListener('change', loadMembers));

// ---- member modal ----
const mm = $('memberModal');
const MFIELDS = ['full_name', 'email', 'phone', 'dojo', 'rank', 'membership_type', 'status', 'payment_status', 'join_date', 'expiry_date', 'notes'];
function openMember(member) {
  editingId = member ? member.id : null;
  $('mTitle').textContent = member ? 'Edit Member' : 'Add Member';
  $('mErr').classList.add('hidden');
  MFIELDS.forEach((f) => { $('m_' + f).value = member ? (member[f] || '') : (f === 'status' ? 'active' : f === 'payment_status' ? 'paid' : ''); });
  mm.classList.add('open');
}
$('addBtn').addEventListener('click', () => openMember(null));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => mm.classList.remove('open')));
mm.addEventListener('click', (e) => { if (e.target === mm) mm.classList.remove('open'); });

$('rows').addEventListener('click', async (e) => {
  const ed = e.target.closest('[data-edit]');
  const dl = e.target.closest('[data-del]');
  if (ed) { const m = await api('/api/members?id=' + encodeURIComponent(ed.dataset.edit)); openMember(m); }
  if (dl) {
    if (!confirm(`Delete member "${dl.dataset.name}"? This cannot be undone.`)) return;
    await api('/api/members?id=' + encodeURIComponent(dl.dataset.del), { method: 'DELETE' });
    await refresh();
  }
});

$('memberForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {};
  MFIELDS.forEach((f) => { payload[f] = $('m_' + f).value; });
  const save = $('mSave'); save.disabled = true; save.textContent = 'Saving…';
  try {
    if (editingId) await api('/api/members?id=' + encodeURIComponent(editingId), { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/members', { method: 'POST', body: JSON.stringify(payload) });
    mm.classList.remove('open');
    await refresh();
  } catch (err) {
    $('mErr').textContent = err.message; $('mErr').classList.remove('hidden');
  } finally { save.disabled = false; save.textContent = 'Save Member'; }
});

// ---- logout ----
$('logoutBtn').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); location.href = '/admin/login'; });

// ---- admins modal ----
const am = $('adminsModal');
$('adminsBtn').addEventListener('click', async () => { am.classList.add('open'); await loadAdmins(); });
document.querySelectorAll('[data-close-admins]').forEach((b) => b.addEventListener('click', () => am.classList.remove('open')));
am.addEventListener('click', (e) => { if (e.target === am) am.classList.remove('open'); });
async function loadAdmins() {
  const { admins } = await api('/api/admins');
  $('adminList').innerHTML = admins.map((a) => `<li><span><span class="ai-name">${esc(a.name)}</span> <span class="ai-mail">${esc(a.email)}</span></span></li>`).join('');
}
$('adminForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('aErr').classList.add('hidden'); $('aOk').classList.add('hidden');
  try {
    await api('/api/admins', { method: 'POST', body: JSON.stringify({ name: $('a_name').value.trim(), email: $('a_email').value.trim(), password: $('a_password').value }) });
    $('aOk').textContent = 'Admin added.'; $('aOk').classList.remove('hidden');
    $('adminForm').reset();
    await loadAdmins();
  } catch (err) { $('aErr').textContent = err.message; $('aErr').classList.remove('hidden'); }
});
