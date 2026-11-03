// Nơi lưu database.json = Vercel Blob (private). Chống ghi đè bằng ETag (ifMatch) – tương đương SHA của GitHub.
import { sdk, blobFail } from '../blob.js';
const DB = 'data/database.json';
const isConflict = (e) => e?.name === 'BlobPreconditionFailedError' || /precondition|already exists/i.test(String(e?.message || ''));
export const name = 'blob';
export const tokenExpiry = () => null; // token kho do Vercel quản lý, không hết hạn
export async function readDb() {
  try {
    const b = await sdk(); const r = await b.get(DB, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return { exists: false, version: null, text: null };
    return { exists: true, version: r.blob.etag, text: await new Response(r.stream).text() };
  } catch (e) { return blobFail(e); }
}
export async function writeDb(text, version) {
  const b = await sdk();
  try { await b.put(DB, text, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: !!version, ...(version ? { ifMatch: version } : {}) }); return { ok: true }; }
  catch (e) { if (isConflict(e)) return { conflict: true }; return blobFail(e); }
}
export async function putExtra(path, text) { // chỉ tạo mới; đã có thì bỏ qua
  const b = await sdk();
  try { await b.put(path, text, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false }); return true; }
  catch (e) { if (isConflict(e)) return false; return blobFail(e); }
}
export async function listExtra(prefix) { const b = await sdk(); const r = await b.list({ prefix }); return r.blobs.map((x) => ({ name: x.pathname.split('/').pop(), ref: x.pathname })); }
export async function delExtra(ref) { const b = await sdk(); await b.del(ref); }
