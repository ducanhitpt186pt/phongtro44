// Vercel Blob (kho RIÊNG TƯ): dùng cho ảnh CCCD và (mặc định) cho cả file dữ liệu database.json.
// Thông tin đăng nhập BLOB_READ_WRITE_TOKEN do Vercel tự tạo khi nối kho, KHÔNG có hạn dùng, không phải thay.
import { ApiError } from './errors.js';

// ---- Bản giả lập trong bộ nhớ, CHỈ để kiểm thử (E2E_FAKE_BLOB=1). Mô phỏng ETag + ifMatch + allowOverwrite. ----
export const fakeStore = { files: new Map(), n: 0, beforePut: null, failPuts: 0 };
const fake = {
  put: async (p, body, o = {}) => {
    if (fakeStore.failPuts > 0) { fakeStore.failPuts--; throw new Error('Service unavailable'); }
    if (fakeStore.beforePut) { const f = fakeStore.beforePut; fakeStore.beforePut = null; f(); }
    const cur = fakeStore.files.get(p);
    if (cur && !o.allowOverwrite) throw new Error('This blob already exists');
    if (cur && o.ifMatch && o.ifMatch !== cur.etag) { const e = new Error('Precondition failed'); e.name = 'BlobPreconditionFailedError'; throw e; }
    const pathname = !cur && o.addRandomSuffix ? p.replace(/(\.\w+)?$/, `-${++fakeStore.n}$1`) : p;
    fakeStore.files.set(pathname, { buf: Buffer.from(body), etag: `"e${++fakeStore.n}"`, at: new Date().toISOString() });
    return { pathname };
  },
  get: async (p) => { const f = fakeStore.files.get(p); return f ? { statusCode: 200, stream: new Blob([f.buf]).stream(), blob: { etag: f.etag, contentType: 'application/octet-stream' } } : null; },
  list: async ({ prefix = '' } = {}) => ({ blobs: [...fakeStore.files.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => ({ pathname: k, uploadedAt: v.at })) }),
  del: async (p) => { fakeStore.files.delete(p); },
};
export const hasBlobConfig = () => !!process.env.BLOB_READ_WRITE_TOKEN || !!process.env.E2E_FAKE_BLOB;
export const sdk = async () => {
  if (process.env.E2E_FAKE_BLOB) return fake;
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw Object.assign(new Error('Chưa tạo/kết nối kho Vercel Blob. Làm theo hướng dẫn bước "Tạo kho lưu trữ (Blob)" rồi Redeploy.'), { status: 500, code: 'CONFIG' });
  return import('@vercel/blob');
};
export const blobFail = (e) => {
  if (e instanceof ApiError || e?.code === 'CONFIG') throw e;
  throw new ApiError(502, `Kho Vercel Blob báo lỗi (có thể hết dung lượng/hạn mức hoặc token kho sai): ${String(e?.message || e).slice(0, 160)}`, 'BLOB');
};
const wrap = async (fn) => { try { return await fn(); } catch (e) { return blobFail(e); } };
export const putPrivate = (pathname, buf, contentType) => wrap(async () => (await sdk()).put(pathname, buf, { access: 'private', contentType, addRandomSuffix: true }));
export const getPrivate = (pathname) => wrap(async () => (await sdk()).get(pathname, { access: 'private' }));
export const delPrivate = (pathname) => wrap(async () => (await sdk()).del(pathname));
