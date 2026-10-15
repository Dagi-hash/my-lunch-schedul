'use strict';
const KEY = 'lunchmate.v1';
const CATS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
const REM = { off: 'Off', evening: 'Evening before', morning: 'Morning of' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#000" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const BELL = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 004 0"/></svg>';
const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const P = isNative ? window.Capacitor.Plugins : {};

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = d => addDays(d, -((d.getDay() + 6) % 7));
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const fmtDay = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/* ---------- state ---------- */
let S = null;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
S = Object.assign({ mode: 'weekly', offset: 0, meals: {}, satWeeks: {}, nextId: 100 }, S || {});
const cutoff = key(addDays(today(), -60));
Object.keys(S.meals).forEach(k => { if (k < cutoff) delete S.meals[k]; });
let sel = null, modal = null, pending = null, lpT = null, lpX = 0, lpY = 0, lpFired = false, toastT = null;

function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    syncNative();
}
const meals = k => S.meals[k] || [];
function findMeal(id) {
    for (const k in S.meals) { const m = S.meals[k].find(x => x.id === id); if (m) return { k, m }; }
    return null;
}
function delIds(ids) {
    for (const k in S.meals) {
        S.meals[k] = S.meals[k].filter(m => !ids.has(m.id));
        if (!S.meals[k].length) delete S.meals[k];
    }
}
function selList() {
    const out = new Map();
    sel.forEach(s => {
        const v = s.slice(2);
        if (s[0] === 'd') meals(v).forEach(m => out.set(m.id, { k: v, m }));
        else { const f = findMeal(+v); if (f) out.set(f.m.id, f); }
    });
    return [...out.values()].sort((a, b) => a.k.localeCompare(b.k));
}

/* ---------- rendering ---------- */
function entry(m, daySel) {
    const s = daySel || (sel && sel.has('e:' + m.id));
    return `<div class="en${m.done ? ' done' : ''}${s ? ' sel' : ''}" data-act="entry" data-id="${m.id}" data-lp="e:${m.id}">
        <div class="ck">${m.done ? CHECK : ''}</div>
        <div class="eb"><div class="cat">${esc(m.cat)}${m.remind !== 'off' ? BELL : ''}</div><div class="tx">${esc(m.text)}</div></div>
        ${sel ? '' : `<button class="mini" data-act="edit" data-id="${m.id}">Edit</button>`}</div>`;
}
function dayCard(d, t) {
    const k = key(d), list = meals(k), done = list.filter(m => m.done).length;
    const isSel = !!(sel && sel.has('d:' + k));
    return `<div class="card${isSel ? ' sel' : ''}">
        <div class="dh" data-act="day" data-k="${k}" data-lp="d:${k}">
            <div><div class="dn">${DAYS[d.getDay()]}${k === key(t) ? '<span class="tag">Today</span>' : ''}</div><div class="mono dd">${fmtDay(d)}</div></div>
            <div class="dr"><span class="mono cnt">${list.length ? done + '/' + list.length : ''}</span>
            ${sel ? '' : `${list.length ? `<button class="mini" data-act="delday" data-k="${k}">Delete Whole Day</button>` : ''}<button class="add" data-act="add" data-k="${k}" aria-label="Add meal">+</button>`}</div>
        </div>
        ${list.length ? list.map(m => entry(m, isSel)).join('') : '<div class="empty">No meals planned</div>'}</div>`;
}
function render() {
    const t = today(); let html = '', range = '';
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.v === S.mode));
    if (S.mode === 'weekly') {
        const st = addDays(t, S.offset * 7);
        range = `${fmtDay(st)} – ${fmtDay(addDays(st, 6))}`;
        for (let i = 0; i < 7; i++) html += dayCard(addDays(st, i), t);
    } else {
        const m0 = addDays(monday(t), S.offset * 28);
        range = `${fmtDay(m0)} – ${fmtDay(addDays(m0, 27))}`;
        for (let w = 0; w < 4; w++) {
            const ws = addDays(m0, w * 7), wk = key(ws);
            const hasSat = S.satWeeks[wk] || meals(key(addDays(ws, 5))).length;
            html += `<section class="week"><div class="wh"><div><div class="lbl">Week ${w + 1}</div><div class="mono dd">${fmtDay(ws)} – ${fmtDay(addDays(ws, 6))}</div></div>
                ${hasSat ? '' : `<button class="mini" data-act="addsat" data-w="${wk}">+ Add Saturday</button>`}</div>`;
            for (let i = 0; i < (hasSat ? 6 : 5); i++) html += dayCard(addDays(ws, i), t);
            html += '</section>';
        }
    }
    const mn = $('#main'), top = mn.scrollTop;
    mn.innerHTML = html; mn.scrollTop = top;
    $('#range').textContent = range;
    const td = meals(key(t));
    $('#sum').textContent = td.length ? `Today ${td.filter(m => m.done).length}/${td.length}` : '';
    $('nav').classList.toggle('hidden', !!sel);
    $('#selbar').classList.toggle('hidden', !sel);
    if (sel) $('#selbar').innerHTML = `<span class="mono">${sel.size} selected</span><button class="btn ghost sm" data-act="sel-edit">Edit</button><button class="btn danger sm" data-act="sel-del">Delete</button><button class="btn ghost sm" data-act="sel-cancel">Cancel</button>`;
}

/* ---------- sheets ---------- */
function open(html) { const s = $('#sheet'); s.innerHTML = `<div class="panel">${html}</div>`; s.classList.remove('hidden'); }
function close() { $('#sheet').classList.add('hidden'); $('#sheet').innerHTML = ''; modal = null; pending = null; }
function ask(msg, label, fn) {
    pending = fn;
    open(`<div class="lbl">Confirm</div><p class="msg">${msg}</p><div class="row"><button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" data-act="yes">${label}</button></div>`);
}
function openMeal(o) {
    const f = o.id ? findMeal(o.id) : null;
    modal = { id: o.id || 0, k: f ? f.k : o.k, cat: f ? f.m.cat : 'Lunch', text: f ? f.m.text : '', remind: f ? f.m.remind : 'off' };
    drawMeal();
}
function drawMeal() {
    const ft = $('#f-text'); if (ft) modal.text = ft.value;
    open(`<div class="lbl">${modal.id ? 'Edit Meal' : 'Add Meal'} · ${DAYS[parse(modal.k).getDay()]} ${fmtDay(parse(modal.k))}</div>
        <div class="fl">Category</div><div class="chips">${CATS.map(c => `<button class="chip${modal.cat === c ? ' on' : ''}" data-act="pickcat" data-v="${c}">${c}</button>`).join('')}</div>
        <div class="fl">Food items</div><input id="f-text" maxlength="140" placeholder="e.g. Rice, chicken, apple" value="${esc(modal.text)}">
        <div class="fl">Reminder</div><div class="chips">${Object.keys(REM).map(v => `<button class="chip${modal.remind === v ? ' on' : ''}" data-act="pickrem" data-v="${v}">${REM[v]}</button>`).join('')}</div>
        <div class="row"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="save">Save</button></div>`);
}
function saveMeal() {
    const text = $('#f-text').value.trim();
    if (!text) { $('#f-text').focus(); return; }
    if (modal.id) {
        const m = findMeal(modal.id).m;
        if (m.remind !== modal.remind) m.fired = false;
        Object.assign(m, { cat: modal.cat, text, remind: modal.remind });
    } else {
        (S.meals[modal.k] = S.meals[modal.k] || []).push({ id: S.nextId++, cat: modal.cat, text, done: false, remind: modal.remind, fired: false });
    }
    close(); save(); render(); checkReminders();
}
function openBulk() {
    const list = selList();
    if (!list.length) { toast('Nothing to edit', 'The selected days have no meals.'); return; }
    open(`<div class="lbl">Bulk Edit · ${list.length} meal${list.length > 1 ? 's' : ''}</div>` + list.map(({ k, m }) =>
        `<div class="brow"><div class="mono dd">${DAYS[parse(k).getDay()].slice(0, 3)} ${fmtDay(parse(k))}</div>
        <select data-bc="${m.id}">${CATS.map(c => `<option${c === m.cat ? ' selected' : ''}>${c}</option>`).join('')}</select>
        <input data-bt="${m.id}" value="${esc(m.text)}" maxlength="140"></div>`).join('') +
        `<div class="row"><button class="btn ghost" data-act="close">Cancel</button><button class="btn" data-act="bulksave">Save All</button></div>`);
}
function saveBulk() {
    selList().forEach(({ m }) => {
        const c = document.querySelector(`[data-bc="${m.id}"]`), t = document.querySelector(`[data-bt="${m.id}"]`);
        if (c) m.cat = c.value;
        if (t && t.value.trim()) m.text = t.value.trim();
    });
    close(); sel = null; save(); render();
}

/* ---------- toast & reminders ---------- */
function toast(title, body) {
    const t = $('#toast');
    t.innerHTML = `<div><b>${esc(title)}</b>${esc(body)}</div><button data-act="toast-x">OK</button>`;
    t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 12000);
}
function remindAt(k, r) {
    const d = parse(k);
    if (r === 'evening') { d.setDate(d.getDate() - 1); d.setHours(20, 0, 0, 0); } else d.setHours(7, 0, 0, 0);
    return d;
}
function checkReminders() {
    const now = Date.now(); let changed = false;
    for (const k in S.meals) S.meals[k].forEach(m => {
        if (m.remind === 'off' || m.done || m.fired) return;
        const t = remindAt(k, m.remind).getTime();
        if (t > now) return;
        m.fired = true; changed = true;
        if (now - t < 6 * 3600e3) toast(m.remind === 'evening' ? 'Prep for tomorrow' : 'Meal prep today', `${m.cat}: ${m.text}`);
    });
    if (changed) { save(); render(); }
}

/* ---------- native background reminders (Android) ---------- */
let nReady = false, nT = null;
function syncNative() { if (!P.LocalNotifications) return; clearTimeout(nT); nT = setTimeout(doSync, 400); }
async function doSync() {
    const LN = P.LocalNotifications;
    try {
        const list = [], now = Date.now();
        for (const k in S.meals) S.meals[k].forEach(m => {
            if (m.remind === 'off' || m.done || m.fired) return;
            const t = remindAt(k, m.remind);
            if (t.getTime() > now) list.push({ id: m.id, title: m.remind === 'evening' ? 'Prep for tomorrow' : 'Meal prep today', body: `${m.cat}: ${m.text}`, channelId: 'reminders', schedule: { at: t, allowWhileIdle: true } });
        });
        let p = await LN.checkPermissions();
        if (p.display !== 'granted') { if (!list.length) return; p = await LN.requestPermissions(); if (p.display !== 'granted') return; }
        if (!nReady) { await LN.createChannel({ id: 'reminders', name: 'Meal reminders', importance: 5, visibility: 1, vibration: true }); nReady = true; }
        const pend = await LN.getPending();
        if (pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
        if (list.length) await LN.schedule({ notifications: list });
    } catch (e) { console.error(e); }
}

/* ---------- interaction ---------- */
function toggleSel(id) {
    sel = sel || new Set();
    sel.has(id) ? sel.delete(id) : sel.add(id);
    if (!sel.size) sel = null;
}
document.addEventListener('click', e => {
    if (lpFired) { lpFired = false; return; }
    if (e.target.id === 'sheet') { close(); return; }
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, k = el.dataset.k, id = +el.dataset.id, v = el.dataset.v;
    switch (a) {
        case 'mode': S.mode = v; S.offset = 0; sel = null; save(); render(); break;
        case 'nav': S.offset = v === '0' ? 0 : S.offset + +v; save(); render(); break;
        case 'add': openMeal({ k }); break;
        case 'edit': openMeal({ id }); break;
        case 'entry': if (sel) toggleSel('e:' + id); else { const m = findMeal(id).m; m.done = !m.done; save(); } render(); break;
        case 'day': if (sel) { toggleSel('d:' + k); render(); } break;
        case 'delday': ask(`Delete all ${meals(k).length} meal(s) on ${fmtDay(parse(k))}?`, 'Delete Day', () => { S.meals[k] = []; delete S.meals[k]; close(); save(); render(); }); break;
        case 'addsat': S.satWeeks[el.dataset.w] = true; save(); render(); break;
        case 'pickcat': modal.text = $('#f-text').value; modal.cat = v; drawMeal(); break;
        case 'pickrem': modal.text = $('#f-text').value; modal.remind = v; drawMeal(); break;
        case 'save': saveMeal(); break;
        case 'bulksave': saveBulk(); break;
        case 'close': close(); break;
        case 'yes': { const f = pending; if (f) f(); break; }
        case 'sel-cancel': sel = null; render(); break;
        case 'sel-edit': openBulk(); break;
        case 'sel-del': {
            const list = selList();
            ask(`Delete ${list.length} selected meal${list.length === 1 ? '' : 's'}?`, 'Delete', () => { delIds(new Set(list.map(x => x.m.id))); sel = null; close(); save(); render(); });
            break;
        }
        case 'toast-x': $('#toast').classList.add('hidden'); break;
    }
});
/* press-and-hold on a meal or a day starts bulk selection */
document.addEventListener('pointerdown', e => {
    lpFired = false;
    const el = e.target.closest('[data-lp]');
    if (!el || e.target.closest('button') || !$('#sheet').classList.contains('hidden')) return;
    lpX = e.clientX; lpY = e.clientY;
    lpT = setTimeout(() => { lpFired = true; toggleSel(el.dataset.lp); if (navigator.vibrate) navigator.vibrate(30); render(); }, 520);
});
['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => clearTimeout(lpT)));
document.addEventListener('pointermove', e => { if (lpT && Math.hypot(e.clientX - lpX, e.clientY - lpY) > 10) clearTimeout(lpT); });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(); render(); } });
if (P.App && P.App.addListener) {
    P.App.addListener('backButton', () => {
        if (!$('#sheet').classList.contains('hidden')) close();
        else if (sel) { sel = null; render(); }
        else P.App.exitApp();
    });
}

render();
checkReminders();
syncNative();
setInterval(checkReminders, 30000);
