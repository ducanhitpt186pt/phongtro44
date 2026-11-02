// Ảnh CCCD lưu trong Vercel Blob (kho RIÊNG TƯ). Ảnh chỉ được đọc qua API đã xác thực.
// Import động để các chức năng khác vẫn chạy nếu chưa tạo kho Blob.
const mem = new Map(); // chỉ dùng khi chạy kiểm thử E2E (E2E_FAKE_BLOB=1)
const fake = {
  put: async (p, buf) => { const pathname = `${p.replace(/\.jpg$/, '')}-${mem.size}.jpg`; mem.set(pathname, buf); return { pathname }; },
  get: async (p) => (mem.has(p) ? { statusCode: 200, stream: new Blob([mem.get(p)]).stream(), blob: { contentType: 'image/jpeg' } } : null),
  del: async (p) => { mem.delete(p); },
};
const sdk = async () => {
  if (process.env.E2E_FAKE_BLOB) return fake;
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw Object.assign(new Error('Chưa tạo kho lưu trữ ảnh (Vercel Blob). Làm theo hướng dẫn bước "Tạo kho ảnh CCCD".'), { status: 500, code: 'CONFIG' });
  return import('@vercel/blob');
};
export const putPrivate = async (pathname, buf, contentType) => (await sdk()).put(pathname, buf, { access: 'private', contentType, addRandomSuffix: true });
export const getPrivate = async (pathname) => (await sdk()).get(pathname, { access: 'private' });
export const delPrivate = async (pathname) => (await sdk()).del(pathname);
