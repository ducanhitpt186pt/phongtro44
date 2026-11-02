import { toast, closeModal } from './util.js';
export const acts = {}; export const forms = {}; export const live = {}; export const changes = {};
let renderFn = () => {};
export const setRender = (f) => (renderFn = f);
export const rerender = () => renderFn();
export const go = (h) => { if (location.hash === h) renderFn(); else location.hash = h; };
const report = (ex, f) => { if (f) { f.textContent = ex.message; f.scrollIntoView?.({ block: 'nearest' }); } else toast(ex.message, 'err'); };
export function initEvents() {
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
