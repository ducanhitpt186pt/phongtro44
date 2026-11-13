import { toast, closeModal } from './util.js';
export const acts = {}; export const forms = {}; export const live = {}; export const changes = {};
let renderFn = () => {};
export const setRender = (f) => (renderFn = f);
export const rerender = () => renderFn();
export const go = (h) => { if (location.hash === h) renderFn(); else location.hash = h; };
const report = (ex, f) => { if (f) { f.textContent = ex.message; f.scrollIntoView?.({ block: 'nearest' }); } else toast(ex.message, 'err'); };
acts['modal-close'] = () => closeModal(); // nút ✕ của hộp thoại
// Ô nhập tiền: gõ 1200000 hiện 1.200.000 (toInt() đã bỏ dấu chấm khi lưu)
const MONEY = /^(amount|rent|elecPrice|waterPrice|manualDebt|newRent|newElecPrice|newWaterPrice|openingDebt|otherAmount|extraAmount|x\da)$/;
const fmtMoney = (el) => { const pos = el.selectionStart ?? el.value.length; const digitsBefore = el.value.slice(0, pos).replace(/\D/g, '').length; const out = el.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); if (out === el.value) return; el.value = out; let c = 0, i = 0; for (; i < out.length && c < digitsBefore; i++) if (/\d/.test(out[i])) c++; try { el.setSelectionRange(i, i); } catch { /* một số kiểu ô nhập không hỗ trợ */ } };
export function initMoney() {
  document.addEventListener('error', (e) => { const el = e.target; if (el instanceof HTMLImageElement && el.classList.contains('idimg')) { el.hidden = true; const m = el.nextElementSibling; if (m && m.classList.contains('idfail')) m.hidden = false; } }, true);
  document.addEventListener('input', (e) => { const el = e.target; if (el instanceof HTMLInputElement && MONEY.test(el.name || '')) fmtMoney(el); }, true);
  new MutationObserver(() => document.querySelectorAll('input').forEach((el) => { if (MONEY.test(el.name || '') && /^\d{4,}$/.test(el.value)) fmtMoney(el); })).observe(document.body, { childList: true, subtree: true });
}
export function initEvents() {
  initMoney();
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act;
    if (a === 'modal-backdrop') { if (e.target === el) closeModal(); return; }
    const fn = acts[a]; if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    try { await fn(el, e); } catch (ex) { if (!ex.handled) toast(ex.message, 'err'); }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
    const fn = forms[f.dataset.form]; if (!fn) return;
    const btn = f.querySelector('button[type=submit]'); const errEl = f.querySelector('.err-inline'); if (errEl) errEl.textContent = '';
    if (btn) btn.disabled = true;
    try { await fn(f, new FormData(f)); } catch (ex) { report(ex, errEl); } finally { if (btn && btn.isConnected) btn.disabled = false; }
  });
  document.addEventListener('input', (e) => { const f = e.target.closest('form[data-live]'); if (f) live[f.dataset.live]?.(f, e); });
  document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el) changes[el.dataset.change]?.(el, e); const f = e.target.closest('form[data-live]'); if (f) live[f.dataset.live]?.(f, e); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}
