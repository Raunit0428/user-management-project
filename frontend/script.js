'use strict';

const API       = 'http://localhost:8080/users';
const EMAIL_API = 'http://localhost:8080/email';

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let allUsers      = [];       // full list from server
let editingUserId = null;     // id of user currently being edited
let deleteTarget  = null;     // id pending delete confirmation
const debounce    = {};       // per-field debounce handles

/* ═══════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════ */
let _toastTimer;
function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    const icons = {
        success: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
        error:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        info:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };
    el.innerHTML = (icons[type] || icons.info) + msg;
    el.className = `toast ${type} show`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { el.className = 'toast'; }, 3600);
}

/* ═══════════════════════════════════════════════════════════
   FIELD HELPERS  (visual state on inputs + hints)
═══════════════════════════════════════════════════════════ */
function fieldErr(inputId, hintId, msg) {
    const inp = $id(inputId), hint = $id(hintId);
    inp.classList.add('is-error'); inp.classList.remove('is-ok');
    hint.className = 'field-hint is-err';
    hint.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${msg}`;
}
function fieldOk(inputId, hintId, msg = '') {
    const inp = $id(inputId), hint = $id(hintId);
    inp.classList.remove('is-error'); inp.classList.add('is-ok');
    hint.className = 'field-hint is-ok';
    hint.innerHTML = msg
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>${msg}`
        : '';
}
function fieldChecking(inputId, hintId) {
    const inp = $id(inputId), hint = $id(hintId);
    inp.classList.remove('is-error','is-ok');
    hint.className = 'field-hint is-info';
    hint.innerHTML = `<span class="spin-dot"></span> Checking…`;
}
function fieldClear(inputId, hintId) {
    const inp = $id(inputId), hint = $id(hintId);
    inp.classList.remove('is-error','is-ok');
    hint.className = 'field-hint';
    hint.innerHTML = '';
}
function setStatus(statusId, icon) {
    $id(statusId).textContent = icon;
}

/* ═══════════════════════════════════════════════════════════
   EMAIL VALIDATION  — 4 layers
═══════════════════════════════════════════════════════════ */

// Layer 1 — instant regex (no network)
function emailFormatOk(email) {
    return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
}

// Layer 2+3 — backend format check (regex + blocked domains)
// Layer 4   — backend MX DNS lookup (proves domain can receive real email)
// Layer 5   — DB duplicate check
async function fullEmailCheck(inputId, hintId, statusId, excludeId = null) {
    const email = $id(inputId).value.trim();

    if (!email) { fieldClear(inputId, hintId); setStatus(statusId, ''); return false; }

    // L1: instant format
    if (!emailFormatOk(email)) {
        fieldErr(inputId, hintId, 'Invalid format — use user@domain.com');
        setStatus(statusId, '❌');
        return false;
    }

    // L2: backend format + blocked domains
    fieldChecking(inputId, hintId); setStatus(statusId, '');
    try {
        const fmtRes  = await fetch(`${EMAIL_API}/format-check?email=${enc(email)}`);
        const fmtData = await fmtRes.json();
        if (!fmtData.valid) {
            fieldErr(inputId, hintId, fmtData.message);
            setStatus(statusId, '❌');
            return false;
        }
    } catch { /* backend offline — skip to next layer */ }

    // L3: real DNS / MX check
    fieldChecking(inputId, hintId);
    try {
        const mxRes  = await fetch(`${EMAIL_API}/mx-check?email=${enc(email)}`);
        const mxData = await mxRes.json();
        if (!mxData.valid) {
            fieldErr(inputId, hintId, mxData.message);
            setStatus(statusId, '❌');
            return false;
        }
    } catch { /* backend offline — skip */ }

    // L4: DB duplicate check
    fieldChecking(inputId, hintId);
    try {
        let url = `${EMAIL_API}/duplicate-check?email=${enc(email)}`;
        if (excludeId) url += `&excludeId=${excludeId}`;
        const dupRes  = await fetch(url);
        const dupData = await dupRes.json();
        if (!dupData.available) {
            fieldErr(inputId, hintId, dupData.message);
            setStatus(statusId, '❌');
            return false;
        }
    } catch { /* backend offline */ }

    fieldOk(inputId, hintId, 'Email verified ✓');
    setStatus(statusId, '✅');
    return true;
}

// Wire live validation to an email input
function wireEmail(inputId, hintId, statusId, getExclude) {
    const el = $id(inputId);
    if (!el) return;

    el.addEventListener('input', () => {
        const v = el.value.trim();
        clearTimeout(debounce[inputId]);
        if (!v) { fieldClear(inputId, hintId); setStatus(statusId, ''); return; }
        if (!emailFormatOk(v)) {
            fieldErr(inputId, hintId, 'Invalid format — use user@domain.com');
            setStatus(statusId, '❌');
        } else {
            // show "checking" after format passes, then debounce full check
            fieldChecking(inputId, hintId);
            setStatus(statusId, '');
            debounce[inputId] = setTimeout(() =>
                fullEmailCheck(inputId, hintId, statusId, getExclude()), 700);
        }
    });

    el.addEventListener('blur', () => {
        clearTimeout(debounce[inputId]);
        if (el.value.trim()) fullEmailCheck(inputId, hintId, statusId, getExclude());
    });
}

/* ═══════════════════════════════════════════════════════════
   NAME VALIDATION
═══════════════════════════════════════════════════════════ */
function validateName(inputId, hintId) {
    const v = $id(inputId).value.trim();
    if (!v || v.length < 2) { fieldErr(inputId, hintId, 'Name must be at least 2 characters'); return false; }
    fieldOk(inputId, hintId);
    return true;
}
function wireNameLive(inputId, hintId) {
    $id(inputId)?.addEventListener('input', () => {
        const v = $id(inputId).value.trim();
        if (!v)          fieldClear(inputId, hintId);
        else if (v.length < 2) fieldErr(inputId, hintId, 'At least 2 characters');
        else             fieldOk(inputId, hintId);
    });
}

/* ═══════════════════════════════════════════════════════════
   CREATE
═══════════════════════════════════════════════════════════ */
async function addUser() {
    const nameOk  = validateName('name', 'nameError');
    const emailOk = await fullEmailCheck('email', 'emailError', 'emailStatus', null);
    if (!nameOk || !emailOk) return;

    const name  = $id('name').value.trim();
    const email = $id('email').value.trim();

    try {
        const res  = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,email}) });
        const data = await res.json();
        if (!res.ok) {
            if (data.email) fieldErr('email', 'emailError', data.email);
            if (data.name)  fieldErr('name',  'nameError',  data.name);
            if (data.error) toast(data.error, 'error');
            return;
        }
        toast('Member added successfully!', 'success');
        resetAddForm();
        await getUsers();
    } catch { toast('Could not connect to server', 'error'); }
}

/* ═══════════════════════════════════════════════════════════
   READ + RENDER
═══════════════════════════════════════════════════════════ */
async function getUsers() {
    showLoading(true);
    clearSearch();          // reset search when refreshing
    try {
        const res = await fetch(API);
        if (!res.ok) throw new Error();
        allUsers = await res.json();
        renderTable(allUsers, '');
    } catch {
        showLoading(false);
        $id('countNum').textContent = '—';
        $id('userTableBody').innerHTML = `<tr><td colspan="4"><div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style="color:var(--danger)">Cannot connect to backend on port 8080</p>
        </div></td></tr>`;
    }
}

const PALETTE = ['#60a5fa','#a78bfa','#4ade80','#fb923c','#f87171','#38bdf8','#f9a8d4','#86efac','#fde68a','#c4b5fd'];

function renderTable(users, highlight) {
    showLoading(false);
    $id('countNum').textContent = allUsers.length;

    const badge = $id('searchBadge');
    if (highlight && users.length !== allUsers.length) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <strong>${users.length}</strong> result${users.length !== 1 ? 's' : ''} for "<strong>${escHtml(highlight)}</strong>"`;
    } else {
        badge.style.display = 'none';
    }

    const tbody = $id('userTableBody');
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p>${highlight ? `No results for "<strong>${escHtml(highlight)}</strong>"` : 'No members yet — add one above!'}</p>
        </div></td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    users.forEach((user, i) => {
        const serial   = i + 1;    // ← sequential, re-numbers on every delete/search
        const color    = PALETTE[i % PALETTE.length];
        const initials = user.name.trim().split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?';
        const hlName   = highlight ? hilite(escHtml(user.name),  highlight) : escHtml(user.name);
        const hlEmail  = highlight ? hilite(escHtml(user.email), highlight) : escHtml(user.email);

        const tr = document.createElement('tr');
        tr.dataset.id = user.id;
        tr.style.animationDelay = `${i * 0.035}s`;
        tr.innerHTML = `
            <td class="serial">${serial}</td>
            <td><div class="user-avatar">
                <div class="avatar-circle" style="background:${color}">${initials}</div>
                <span class="user-name">${hlName}</span>
            </div></td>
            <td><span class="email-chip">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                ${hlEmail}
            </span></td>
            <td class="actions-cell">
                <button class="btn btn-edit"   onclick="openEdit(${user.id},'${escJs(user.name)}','${escJs(user.email)}')">✏ Edit</button>
                <button class="btn btn-delete" onclick="askDelete(${user.id},'${escJs(user.name)}')">✕ Delete</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

/* ═══════════════════════════════════════════════════════════
   SEARCH  — queries backend, falls back to client-side filter
═══════════════════════════════════════════════════════════ */
let _searchTimer;
function onSearch() {
    const q = $id('searchInput').value.trim();
    $id('clearSearch').style.display = q ? 'flex' : 'none';
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => doSearch(q), 280);
}

async function doSearch(q) {
    if (!q) { renderTable(allUsers, ''); return; }
    showLoading(true);
    try {
        const res   = await fetch(`${API}/search?q=${enc(q)}`);
        const data  = await res.json();
        renderTable(data, q);
    } catch {
        // backend offline: filter allUsers client-side
        const lq = q.toLowerCase();
        const filtered = allUsers.filter(u =>
            u.name.toLowerCase().includes(lq) || u.email.toLowerCase().includes(lq));
        renderTable(filtered, q);
    }
}

function clearSearch() {
    const si = $id('searchInput');
    if (!si) return;
    si.value = '';
    $id('clearSearch').style.display = 'none';
    $id('searchBadge').style.display = 'none';
    renderTable(allUsers, '');
}

/* ═══════════════════════════════════════════════════════════
   UPDATE
═══════════════════════════════════════════════════════════ */
function openEdit(id, name, email) {
    editingUserId = id;
    $id('editId').value    = id;
    $id('editName').value  = name;
    $id('editEmail').value = email;
    fieldClear('editName',  'editNameError');
    fieldClear('editEmail', 'editEmailError');
    $id('editEmailStatus').textContent = '';
    $id('editModal').style.display = 'flex';
}
function closeModal() {
    editingUserId = null;
    $id('editModal').style.display = 'none';
}
function closeModalOutside(e) { if (e.target === $id('editModal')) closeModal(); }

async function updateUser() {
    const nameOk  = validateName('editName', 'editNameError');
    const emailOk = await fullEmailCheck('editEmail', 'editEmailError', 'editEmailStatus', editingUserId);
    if (!nameOk || !emailOk) return;

    const id    = $id('editId').value;
    const name  = $id('editName').value.trim();
    const email = $id('editEmail').value.trim();

    try {
        const res  = await fetch(API, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:+id,name,email}) });
        const data = await res.json();
        if (!res.ok) {
            if (data.email) fieldErr('editEmail', 'editEmailError', data.email);
            if (data.name)  fieldErr('editName',  'editNameError',  data.name);
            if (data.error) toast(data.error, 'error');
            return;
        }
        toast('Member updated!', 'success');
        closeModal();
        await getUsers();
    } catch { toast('Could not connect to server', 'error'); }
}

/* ═══════════════════════════════════════════════════════════
   DELETE  — custom confirm modal instead of browser confirm()
═══════════════════════════════════════════════════════════ */
function askDelete(id, name) {
    deleteTarget = id;
    $id('deleteSubText').textContent = `"${name}" will be permanently removed.`;
    $id('deleteModal').style.display = 'flex';
    $id('confirmDeleteBtn').onclick = confirmDelete;
}
function closeDeleteModal() {
    deleteTarget = null;
    $id('deleteModal').style.display = 'none';
}
function closeDeleteOutside(e) { if (e.target === $id('deleteModal')) closeDeleteModal(); }

async function confirmDelete() {
    const id  = deleteTarget;
    closeDeleteModal();

    // Animate row out immediately
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) { row.style.opacity = '0'; row.style.transform = 'translateX(18px)'; }

    try {
        const res = await fetch(`${API}/${id}`, { method:'DELETE' });
        if (!res.ok) throw new Error();
        // Remove from local cache → serial numbers instantly re-sequence without a network call
        allUsers = allUsers.filter(u => u.id !== id);
        const q  = $id('searchInput').value.trim();
        const visible = q
            ? allUsers.filter(u => u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()))
            : allUsers;
        renderTable(visible, q);
        $id('countNum').textContent = allUsers.length;
        toast('Member deleted', 'info');
    } catch {
        if (row) { row.style.opacity = '1'; row.style.transform = ''; }
        toast('Could not delete member', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function $id(id)     { return document.getElementById(id); }
function enc(s)      { return encodeURIComponent(s); }
function escHtml(s)  { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escJs(s)    { return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"'); }

// Wrap matched substring in <mark>
function hilite(escaped, q) {
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return escaped.replace(new RegExp(`(${safeQ})`, 'gi'), '<mark>$1</mark>');
}

function showLoading(on) {
    $id('loading').style.display = on ? 'block' : 'none';
}

function resetAddForm() {
    ['name','email'].forEach(id => { $id(id).value = ''; fieldClear(id, id+'Error'); });
    $id('emailStatus').textContent = '';
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    wireEmail('email',     'emailError',     'emailStatus',     () => null);
    wireEmail('editEmail', 'editEmailError', 'editEmailStatus', () => editingUserId);
    wireNameLive('name',     'nameError');
    wireNameLive('editName', 'editNameError');
    getUsers();
});
