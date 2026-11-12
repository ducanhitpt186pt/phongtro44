// Lịch tháng (dương + âm), ngày lễ, sự kiện (thêm/sửa/xóa khi đã đăng nhập), thông báo trước 3 ngày, danh sách sự kiện trong năm.
import { html, raw, dmy, weekday, field, openModal, closeModal, toast, $, todayLocal, esc } from '../util.js';
import { S, save, today } from '../api.js';
import { acts, forms, live, changes, rerender } from '../ui.js';
import { icon } from '../icons.js';
import { canChi } from '../lunar.js';
import * as EV from '../events-core.js';

const st = { y: null, m: null, sel: null, year: null };
const evs = () => (S.loggedIn && S.snap ? S.snap.db.events : S.pub?.events || []);
const T = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const lunarName = (s) => { const l = EV.lunarOf(s); return `${l.day}/${l.month}${l.leap ? ' nhuận' : ''} năm ${canChi(l.year)}`; };
const refresh = () => { const pc = $('#pubcal'); if (pc && !S.loggedIn) pc.innerHTML = calendarPanel().s; else rerender(); };
function init() { const t = today() || todayLocal(); if (st.y === null) { st.y = Number(t.slice(0, 4)); st.m = Number(t.slice(5, 7)); } if (!st.year) st.year = Number(t.slice(0, 4)); }
function dayInfo(date, events) {
  const h = EV.holidaysInYear(Number(date.slice(0, 4))).filter((x) => x.date === date);
  const o = EV.occurrences(events, date, date).map((x) => x.ev);
  return { h, o };
}
const tipOf = (date, info) => [...info.h.map((x) => `${x.name} (${dmy(date)}${x.cal === 'lunar' ? ` · ${x.lunar} âm` : ''})`), ...info.o.map((e) => `${e.name} – ${dmy(date)} · ${EV.lunarLabel(date)} âm`)].join('\n');

// ---- Thông báo ở đầu trang: còn ≤ 3 ngày → hiện đến hết ngày diễn ra ----
export function eventBanner(events, t) {
  const up = EV.upcoming(events || [], t, 3); if (!up.length) return '';
  return html`<div class="evbanner">${up.map((u) => html`<div class="evn" style="--c:${u.ev.color || '#007aff'}"><span class="evn-i">${raw(icon('star', '1.3em'))}</span><div class="sp"><b>${u.ev.name}</b><span>${u.left === 0 ? 'Hôm nay' : `Còn ${u.left} ngày`} · ${weekday(u.date)}, ${dmy(u.date)} · ${EV.lunarLabel(u.date)} âm</span></div></div>`)}</div>`;
}

export function calendarPanel({ editable = false } = {}) {
  init(); const t = today() || todayLocal(); const events = evs();
  const grid = EV.monthGrid(st.y, st.m); const first = EV.iso(st.y, st.m, 1), last = EV.iso(st.y, st.m, EV.dim(st.y, st.m));
  const l1 = EV.lunarOf(first), l2 = EV.lunarOf(last);
  const hol = EV.holidaysInMonth(st.y, st.m); const inMonth = EV.occurrences(events, first, last);
  const sel = st.sel && st.sel.startsWith(`${st.y}-${String(st.m).padStart(2, '0')}`) ? st.sel : null;
  return html`<section class="cal" id="cal"><div class="cal-head"><button class="btn sm ic-btn" data-act="cal-prev" aria-label="Tháng trước">${raw(icon('chevL', '1.2em'))}</button>
    <div class="sp"><h2>Tháng ${st.m} năm ${st.y}</h2><div class="muted small">Âm lịch: tháng ${l1.month}${l1.month !== l2.month ? `–${l2.month}` : ''} năm ${canChi(l2.year)}</div></div>
    <button class="btn sm" data-act="cal-today">Hôm nay</button><button class="btn sm ic-btn" data-act="cal-next" aria-label="Tháng sau">${raw(icon('chevR', '1.2em'))}</button></div>
    <div class="cal-grid"><div class="cal-wd">${T.map((x, i) => html`<span class="${i > 4 ? 'we' : ''}">${x}</span>`)}</div>
    <div class="cal-days">${grid.map((d, i) => {
      if (!d) return html`<span class="cd blank"></span>`;
      const info = dayInfo(d, events); const l = EV.lunarOf(d); const tip = tipOf(d, info); const col = info.o[0]?.color;
      return html`<button type="button" class="cd ${d === t ? 'today' : ''} ${i % 7 > 4 ? 'we' : ''} ${info.h.some((x) => x.kind === 'official') ? 'off' : info.h.length ? 'trad' : ''} ${info.o.length ? 'hasev' : ''} ${sel === d ? 'sel' : ''}" data-act="cal-day" data-date="${d}" ${tip ? raw(`data-tip="${esc(tip)}"`) : ''} ${col ? raw(`style="--c:${col}"`) : ''} aria-label="${dmy(d)}${tip ? ': ' + tip.replace(/\n/g, ', ') : ''}">
        <span class="sd">${Number(d.slice(8))}</span><span class="ld ${l.day === 1 ? 'm1' : ''}">${l.day === 1 ? `${l.day}/${l.month}` : l.day}</span>
        <span class="dots">${info.o.slice(0, 4).map((e) => html`<i style="background:${e.color}"></i>`)}${info.h.length ? html`<i class="hd"></i>` : ''}</span></button>`;
    })}</div></div>
    <div id="caldetail" class="cal-detail">${sel ? detailOf(sel, events, editable) : html`<span class="muted small">Chạm (hoặc rê chuột) vào một ngày để xem sự kiện. Chấm màu = sự kiện; chấm đỏ nhỏ = ngày lễ.</span>`}</div>
    <h3 class="cal-sub">Ngày lễ & sự kiện trong tháng ${st.m}</h3>
    <div class="list">${[...hol.map((h) => ({ date: h.date, name: h.name, sub: h.cal === 'lunar' ? `${h.lunar} âm lịch` : 'Dương lịch', color: h.kind === 'official' ? '#ff3b30' : '#ff9500', tag: h.kind === 'official' ? 'Nghỉ lễ' : 'Ngày kỷ niệm' })), ...inMonth.map((o) => ({ date: o.date, name: o.ev.name, sub: `${EV.lunarLabel(o.date)} âm lịch`, color: o.ev.color, tag: 'Sự kiện của bạn' }))].sort((a, b) => a.date.localeCompare(b.date)).map((x) => html`<div class="li"><span class="evdot" style="background:${x.color}"></span><span class="sp"><b>${x.name}</b><br><span class="muted small">${weekday(x.date)}, ${dmy(x.date)} · ${x.sub}</span></span><span class="badge">${x.tag}</span></div>`)}${hol.length + inMonth.length ? '' : html`<div class="empty-state" style="padding:14px">Tháng này không có ngày lễ hoặc sự kiện.</div>`}</div>
    ${eventList(events, editable)}</section>`;
}
function detailOf(date, events, editable) {
  const info = dayInfo(date, events); const l = lunarName(date);
  return html`<div class="cal-d"><b>${weekday(date)}, ${dmy(date)}</b><span class="muted"> · Âm lịch ${l}</span>${info.h.map((h) => html`<div class="dline"><span class="evdot" style="background:${h.kind === 'official' ? '#ff3b30' : '#ff9500'}"></span>${h.name}</div>`)}${info.o.map((e) => html`<div class="dline"><span class="evdot" style="background:${e.color}"></span><b>${e.name}</b>${editable && e.note ? html`<span class="muted small"> – ${e.note}</span>` : ''}${editable ? html` <button class="btn sm" data-act="ev-edit" data-id="${e.id}">Sửa</button>` : ''}</div>`)}${!info.h.length && !info.o.length ? html`<div class="muted small">Không có sự kiện.</div>` : ''}${editable ? html`<button class="btn sm primary" style="margin-top:8px" data-act="ev-add" data-date="${date}">${raw(icon('plus', '1em'))} Thêm sự kiện vào ngày này</button>` : ''}</div>`;
}
function eventList(events, editable) {
  const y = st.year; const all = EV.occurrences(events, `${y}-01-01`, `${y}-12-31`); const t = today() || todayLocal();
  return html`<div class="row" style="margin-top:22px"><h3 class="cal-sub sp" style="margin:0">Danh sách sự kiện năm ${y}</h3><button class="btn sm ic-btn" data-act="ev-year" data-d="-1" aria-label="Năm trước">${raw(icon('chevL', '1.1em'))}</button><button class="btn sm ic-btn" data-act="ev-year" data-d="1" aria-label="Năm sau">${raw(icon('chevR', '1.1em'))}</button>${editable ? html`<button class="btn primary sm" data-act="ev-add">${raw(icon('plus', '1.1em'))} Thêm sự kiện</button>` : ''}</div>
    <div class="list" style="margin-top:10px">${all.length ? all.map((o) => html`<div class="li ${o.date < t ? 'past' : ''}"><span class="evdot" style="background:${o.ev.color}"></span><span class="sp"><b>${o.ev.name}</b><br><span class="muted small">${weekday(o.date)}, ${dmy(o.date)} · ${EV.lunarLabel(o.date)} âm lịch · ${o.ev.calendar === 'lunar' ? 'tính theo âm lịch' : 'tính theo dương lịch'} · ${o.ev.repeat ? 'lặp hằng năm' : 'chỉ 1 lần'}${editable && o.ev.note ? ` · ${o.ev.note}` : ''}</span></span>${editable ? html`<button class="btn sm" data-act="ev-edit" data-id="${o.ev.id}">${raw(icon('edit', '1em'))} Sửa</button><button class="btn sm danger" data-act="ev-del" data-id="${o.ev.id}">${raw(icon('trash', '1em'))} Xóa</button>` : ''}</div>`) : html`<div class="empty-state">Chưa có sự kiện nào trong năm ${y}.${editable ? ' Bấm "Thêm sự kiện" để tạo.' : ''}</div>`}</div>`;
}
acts['cal-prev'] = () => { st.m -= 1; if (st.m < 1) { st.m = 12; st.y -= 1; } st.sel = null; refresh(); };
acts['cal-next'] = () => { st.m += 1; if (st.m > 12) { st.m = 1; st.y += 1; } st.sel = null; refresh(); };
acts['cal-today'] = () => { const t = today() || todayLocal(); st.y = Number(t.slice(0, 4)); st.m = Number(t.slice(5, 7)); st.sel = t; refresh(); };
acts['cal-day'] = (el) => { st.sel = el.dataset.date; refresh(); setTimeout(() => $('#caldetail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30); };
acts['ev-year'] = (el) => { st.year += Number(el.dataset.d); refresh(); };

// ---- Form thêm / sửa sự kiện ----
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
function evForm(ev, presetDate) {
  const t = today() || todayLocal(); const cal = ev?.calendar || 'solar'; const repeat = ev ? ev.repeat : true;
  const date = ev && ev.calendar === 'solar' ? EV.iso(ev.year || Number(t.slice(0, 4)), ev.month, ev.day) : presetDate || t;
  return html`<form data-form="event" data-id="${ev?.id || ''}" data-live="event">
    ${field('Tên sự kiện *', html`<input name="name" required maxlength="100" value="${ev?.name || ''}" placeholder="Ví dụ: Giỗ ông nội, Sinh nhật con, Họp tổ dân phố">`)}
    <div class="radios" role="radiogroup" aria-label="Loại lịch"><b>Tính theo *</b><label><input type="radio" name="calendar" value="solar" ${cal === 'solar' ? raw('checked') : ''}>Lịch dương</label><label><input type="radio" name="calendar" value="lunar" ${cal === 'lunar' ? raw('checked') : ''}>Lịch âm</label></div>
    <div id="ev-solar" ${cal === 'solar' ? '' : raw('hidden')}>${field('Ngày diễn ra (dương lịch) *', html`<input type="date" name="sdate" value="${date}">`)}</div>
    <div id="ev-lunar" ${cal === 'lunar' ? '' : raw('hidden')}><div class="two keep">${field('Ngày âm *', html`<select name="lday">${Array.from({ length: 30 }, (_, i) => i + 1).map((d) => html`<option value="${d}" ${ev?.day === d ? raw('selected') : ''}>${d}</option>`)}</select>`)}${field('Tháng âm *', html`<select name="lmonth">${MONTHS.map((m) => html`<option value="${m}" ${ev?.month === m ? raw('selected') : ''}>${m}</option>`)}</select>`)}</div>
      <div class="two keep">${field('Năm âm (bỏ trống nếu lặp hằng năm)', html`<input name="lyear" inputmode="numeric" value="${ev?.calendar === 'lunar' && ev.year ? ev.year : ''}" placeholder="vd 2026">`)}<label class="radios" style="align-self:end"><input type="checkbox" name="leap" ${ev?.leap ? raw('checked') : ''}>Tháng nhuận</label></div></div>
    <div class="radios" role="radiogroup" aria-label="Lặp lại"><b>Lặp lại</b><label><input type="radio" name="repeat" value="1" ${repeat ? raw('checked') : ''}>Hằng năm</label><label><input type="radio" name="repeat" value="0" ${repeat ? '' : raw('checked')}>Chỉ 1 lần</label></div>
    <div class="fld"><span>Màu hiển thị trên lịch</span><div class="swatches">${EV.palette.map((c) => html`<label><input type="radio" name="color" value="${c}" ${(ev?.color || '#007aff') === c ? raw('checked') : ''}><i style="background:${c}"></i></label>`)}</div></div>
    ${field('Ghi chú', html`<textarea name="note" maxlength="300" placeholder="Chỉ bạn xem được (trang ngoài không hiện ghi chú)">${ev?.note || ''}</textarea>`)}
    <div class="calc" id="ev-prev"></div><p class="muted small" style="margin:0 0 12px">Hệ thống báo ở đầu trang trước 3 ngày; đến hết ngày diễn ra thì thôi.</p>
    <div class="err-inline"></div><button class="btn primary block" type="submit">${ev ? 'LƯU SỰ KIỆN' : 'THÊM SỰ KIỆN'}</button></form>`;
}
function bodyOf(f) {
  const fd = new FormData(f); const cal = fd.get('calendar'); const repeat = fd.get('repeat') === '1';
  if (cal === 'solar') { const d = fd.get('sdate'); if (!d) throw new Error('Chọn ngày diễn ra'); const [y, m, dd] = d.split('-').map(Number); return { calendar: 'solar', day: dd, month: m, year: y, repeat }; }
  return { calendar: 'lunar', day: Number(fd.get('lday')), month: Number(fd.get('lmonth')), year: fd.get('lyear') ? Number(fd.get('lyear')) : null, leap: fd.get('leap') === 'on', repeat };
}
live.event = (f) => {
  const cal = f.calendar.value; $('#ev-solar').hidden = cal !== 'solar'; $('#ev-lunar').hidden = cal !== 'lunar'; const box = $('#ev-prev'); const t = today() || todayLocal();
  try {
    const b = bodyOf(f);
    if (cal === 'solar') box.textContent = `Âm lịch tương ứng: ${EV.lunarLabel(EV.iso(b.year, b.month, b.day))} (năm ${canChi(EV.lunarOf(EV.iso(b.year, b.month, b.day)).year)})`;
    else { const y = b.year || Number(t.slice(0, 4)); const s = EV.lunarIso(b.day, b.month, y, b.leap && !b.repeat); box.textContent = s ? `Dương lịch năm ${y}: ${dmy(s)} (${weekday(s)})` : `Không có ngày âm ${b.day}/${b.month} năm ${y}`; }
  } catch { box.textContent = ''; }
};
acts['ev-add'] = (el) => openModal('Thêm sự kiện', evForm(null, el.dataset.date));
acts['ev-edit'] = (el) => { const e = S.snap.db.events.find((x) => x.id === el.dataset.id); if (e) openModal('Sửa sự kiện', evForm(e)); };
acts['ev-del'] = async (el) => { const e = S.snap.db.events.find((x) => x.id === el.dataset.id); if (!confirm(`Xóa sự kiện "${e?.name}"?`)) return; await save('DELETE', `events/${el.dataset.id}`, undefined, 'Đã xóa sự kiện'); rerender(); };
forms.event = async (f) => {
  const fd = new FormData(f); const body = { name: fd.get('name'), note: fd.get('note'), color: fd.get('color'), ...bodyOf(f) };
  const id = f.dataset.id; await save(id ? 'PUT' : 'POST', id ? `events/${id}` : 'events', body, id ? 'Đã lưu sự kiện' : 'Đã thêm sự kiện'); closeModal(); rerender();
};

// ---- Trang quản lý lịch (sau đăng nhập) ----
export function calendarView() {
  return html`<div class="page-head"><span class="rbadge blue">${raw(icon('calendar', '1.5em'))}</span><h2>Lịch & sự kiện</h2></div>${calendarPanel({ editable: true })}`;
}
