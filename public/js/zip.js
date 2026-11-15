// Tạo / đọc file .zip ngay trên trình duyệt (không cần thư viện). Tạo: kiểu "lưu nguyên" (ảnh JPG vốn đã nén). Đọc: hỗ trợ cả file nén lại bằng Windows/macOS.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function dosTime(d) { return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }
// files: [{ name: 'Phong 1/anh.jpg', data: Uint8Array }]
export function makeZip(files) {
  const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0; const { time, date } = dosTime(new Date());
  for (const f of files) {
    const name = enc.encode(f.name); const data = f.data instanceof Uint8Array ? f.data : enc.encode(String(f.data)); const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
async function inflateRaw(u8) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt này không giải nén được file zip đã nén lại. Hãy dùng đúng file tải về từ nút Backup Căn Cước (không giải nén rồi nén lại).');
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer());
}
// Trả về [{ name, data: Uint8Array }]
export async function readZip(buf) {
  const u8 = new Uint8Array(buf); const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('File không phải file .zip hợp lệ');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = []; const dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('File .zip bị hỏng');
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (name.endsWith('/')) continue;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true); const raw = u8.subarray(ds, ds + csize);
    out.push({ name, data: method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null });
  }
  return out.filter((f) => f.data);
}
