// BACKUP CĂN CƯỚC: tải ảnh CCCD của khách đang ở (mỗi phòng một thư mục) thành 1 file .zip, và nạp lại ảnh từ file đó.
import { html, toast, $, download } from './util.js';
import { S, D, api, apiUrl } from './api.js';
import { acts, forms, rerender } from './ui.js';
import { makeZip, readZip } from './zip.js';

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'khong-ten';
const SIDE = { front: 'mat-truoc', back: 'mat-sau' };
// Danh sách người đang ở (theo phòng) + ảnh đang có
function people(roomId = null) {
  const list = [];
  for (const r of D().rentals.filter((x) => x.status === 'active' && (!roomId || x.roomId === roomId))) {
    const room = D().rooms.find((x) => x.id === r.roomId); const t = D().tenants.find((x) => x.id === r.tenantId); if (!t || t.purgedAt) continue;
    list.push({ p: t, kind: 'tenant', room, role: 'khach-chinh' });
    for (const o of D().occupants.filter((x) => x.tenantId === t.id)) if (!o.noId) list.push({ p: o, kind: 'occupant', room, role: 'nguoi-o-cung' });
  }
  return list;
}
export function cccdCount(roomId = null) { let have = 0, miss = 0; for (const x of people(roomId)) for (const s of ['front', 'back']) x.p.idImages?.[s] ? have++ : miss++; return { have, miss }; }

export async function backupCccd(roomId = null, onProgress = () => {}) {
  const list = people(roomId); const files = []; const manifest = { app: 'nha-tro-44', kind: 'cccd-backup', createdAt: new Date().toISOString(), items: [] };
  const jobs = list.flatMap((x) => ['front', 'back'].filter((s) => x.p.idImages?.[s]).map((s) => ({ ...x, side: s })));
  if (!jobs.length) throw new Error('Chưa có ảnh CCCD nào của khách đang ở để sao lưu');
  let done = 0, fail = 0;
  for (const j of jobs) {
    const img = j.p.idImages[j.side];
    try {
      const res = await fetch(apiUrl(`storage/${img.id}`), { credentials: 'same-origin' }); if (!res.ok) throw new Error(String(res.status));
      const data = new Uint8Array(await res.arrayBuffer()); const ext = data[0] === 0x89 ? 'png' : data[0] === 0x52 ? 'webp' : 'jpg';
      const name = `${slug(j.room.name)}/${slug(j.p.fullName)}-${j.role}-${SIDE[j.side]}.${ext}`;
      files.push({ name, data }); manifest.items.push({ file: name, ownerId: j.p.id, kind: j.kind, side: j.side, fullName: j.p.fullName, cccd: j.p.cccd || '', room: j.room.name });
    } catch { fail++; }
    onProgress(++done, jobs.length);
  }
  if (!files.length) throw new Error('Không tải được ảnh nào từ kho ảnh. Kiểm tra kết nối Vercel Blob.');
  files.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) });
  files.push({ name: 'DOC-TRUOC.txt', data: new TextEncoder().encode('Sao luu anh CCCD - Nha tro 44 Le Van Phan\r\nMoi phong 1 thu muc. Muon nap lai anh vao web: vao tab Sao luu > muc Backup Can Cuoc > Nap lai anh CCCD tu file .zip, chon DUNG file .zip nay (khong can giai nen).\r\nFile chua thong tin ca nhan, hay cat o noi rieng tu.\r\n') });
  const room = roomId ? D().rooms.find((x) => x.id === roomId) : null;
  const blob = makeZip(files); download(`cccd-${room ? slug(room.name) : 'tat-ca-phong'}-${S.snap.today}.zip`, blob, 'application/zip');
  return { count: files.length - 2, fail };
}

// Nạp lại ảnh từ file .zip: tìm đúng người theo mã (cùng dữ liệu) hoặc theo số CCCD (khi dữ liệu nhập lại từ đầu)
export async function restoreCccd(file, { overwrite = false } = {}, onProgress = () => {}) {
  const entries = await readZip(await file.arrayBuffer()); const mf = entries.find((e) => e.name.endsWith('manifest.json'));
  if (!mf) throw new Error('File .zip không có manifest.json – hãy chọn đúng file tải về từ nút "Backup Căn Cước"');
  let manifest; try { manifest = JSON.parse(new TextDecoder().decode(mf.data)); } catch { throw new Error('manifest.json bị hỏng'); }
  if (manifest.kind !== 'cccd-backup') throw new Error('Đây không phải file Backup Căn Cước của Nhà trọ 44');
  const prefix = mf.name.slice(0, -'manifest.json'.length); const byName = new Map(entries.map((e) => [e.name, e]));
  const all = [...D().tenants.map((p) => ({ p, kind: 'tenant' })), ...D().occupants.map((p) => ({ p, kind: 'occupant' }))].filter((x) => !x.p.purgedAt);
  let ok = 0, skipped = 0, notFound = 0, fail = 0; let done = 0;
  for (const it of manifest.items || []) {
    onProgress(done++, manifest.items.length);
    const e = byName.get(prefix + it.file); if (!e) { fail++; continue; }
    const who = all.find((x) => x.p.id === it.ownerId) || (it.cccd ? all.find((x) => x.p.cccd && x.p.cccd === it.cccd) : null);
    if (!who) { notFound++; continue; }
    if (who.p.idImages?.[it.side] && !overwrite) { skipped++; continue; }
    const d = e.data; const ct = d[0] === 0x89 ? 'image/png' : d[0] === 0x52 ? 'image/webp' : 'image/jpeg';
    try { await api('POST', `storage/upload?ownerId=${encodeURIComponent(who.p.id)}&side=${it.side}`, new Blob([d], { type: ct }), { headers: { 'Content-Type': ct } }); ok++; } catch { fail++; }
  }
  onProgress(done, manifest.items.length);
  return { ok, skipped, notFound, fail, total: (manifest.items || []).length };
}

export function cccdCard() {
  const c = cccdCount(); const rooms = D().rooms.filter((r) => !r.kind && D().rentals.some((x) => x.roomId === r.id && x.status === 'active'));
  return html`<section class="card" style="margin-top:12px" id="cccdcard"><h3>Backup Căn Cước (ảnh CCCD)</h3>
    <p class="muted small" style="margin:6px 0">Ảnh CCCD nằm trong kho ảnh riêng (Vercel Blob), <b>không nằm trong file database.json</b>. Bấm <b>BACKUP CĂN CƯỚC</b> để tải ảnh CCCD của tất cả khách đang ở về máy thành 1 file <b>.zip</b> (mỗi phòng một thư mục). Cất file này cùng chỗ với database.json. Khi cần, nạp lại file .zip là có lại ảnh, không phải xin lại khách.</p>
    <p style="margin:6px 0">Khách đang ở: <b>${c.have}</b> ảnh đã có${c.miss ? html` · <span class="owe">${c.miss} ảnh còn thiếu</span>` : ''}</p>
    <div class="row"><button class="btn primary" data-act="cccd-backup">⬇ BACKUP CĂN CƯỚC (tất cả phòng)</button><button class="btn" data-act="cccd-relink">Tìm lại ảnh còn trên máy chủ</button></div>
    ${rooms.length ? html`<details style="margin-top:10px"><summary class="btn sm">Tải ảnh CCCD của từng phòng</summary><div class="row" style="margin-top:8px">${rooms.map((r) => { const k = cccdCount(r.id); return html`<button class="btn sm" data-act="cccd-backup" data-room="${r.id}">${r.name} (${k.have} ảnh)</button>`; })}</div></details>` : ''}
    <div id="cccdprog" class="small" style="margin-top:8px"></div>
    <h3 style="margin-top:16px">Nạp lại ảnh CCCD từ file .zip</h3>
    <form data-form="cccd-restore"><input type="file" name="file" accept=".zip,application/zip" required style="margin-bottom:10px">
      <label class="radios"><input type="checkbox" name="overwrite"> Thay luôn ảnh đang có (mặc định chỉ bổ sung ảnh còn thiếu)</label>
      <div class="err-inline"></div><button class="btn" type="submit">NẠP ẢNH CCCD</button></form>
    <p class="muted small" style="margin:8px 0 0">Ảnh được gắn đúng người theo mã trong dữ liệu; nếu bạn đã nhập lại khách từ đầu thì gắn theo <b>số CCCD</b>.</p></section>`;
}
const prog = (t) => { const el = $('#cccdprog'); if (el) el.textContent = t; };
acts['cccd-backup'] = async (el) => {
  el.disabled = true;
  try { const r = await backupCccd(el.dataset.room || null, (d, n) => prog(`Đang tải ảnh ${d}/${n}…`)); prog(`Đã tạo file .zip gồm ${r.count} ảnh${r.fail ? ` (${r.fail} ảnh không tải được)` : ''}.`); toast(`Đã tải file Backup Căn Cước (${r.count} ảnh)`); }
  catch (e) { prog(''); toast(e.message, 'err'); } finally { el.disabled = false; }
};
acts['cccd-relink'] = async (el) => {
  el.disabled = true; prog('Đang tìm ảnh trên máy chủ…');
  try { const j = await api('POST', 'storage/relink', {}); prog(j.imagesRelinked ? `Đã nối lại ${j.imagesRelinked} ảnh CCCD.` : 'Không tìm thấy ảnh nào cần nối lại (ảnh đều đã khớp, hoặc không còn trên máy chủ).'); toast(j.imagesRelinked ? `Đã nối lại ${j.imagesRelinked} ảnh CCCD` : 'Không có ảnh nào cần nối lại'); rerender(); }
  catch (e) { prog(''); toast(e.message, 'err'); } finally { el.disabled = false; }
};
forms['cccd-restore'] = async (f, fd) => {
  const file = fd.get('file'); if (!file || !file.size) throw new Error('Chưa chọn file .zip');
  const r = await restoreCccd(file, { overwrite: fd.get('overwrite') === 'on' }, (d, n) => prog(`Đang nạp ảnh ${d}/${n}…`));
  prog(`Đã nạp ${r.ok} ảnh${r.skipped ? ` · bỏ qua ${r.skipped} ảnh vì người đó đã có ảnh` : ''}${r.notFound ? ` · ${r.notFound} ảnh không tìm thấy người tương ứng` : ''}${r.fail ? ` · ${r.fail} ảnh lỗi` : ''}.`);
  toast(`Đã nạp ${r.ok}/${r.total} ảnh CCCD`, r.fail ? 'err' : 'ok'); await api('GET', 'data'); rerender();
};
