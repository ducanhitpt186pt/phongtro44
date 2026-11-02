import { ApiError } from './errors.js';
export async function readBody(req, limit = 4_200_000) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw new ApiError(413, 'Dữ liệu gửi lên quá lớn', 'TOO_LARGE'); chunks.push(c); }
  return Buffer.concat(chunks);
}
export async function readJson(req) {
  const buf = await readBody(req, 6_000_000);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { throw new ApiError(400, 'Dữ liệu gửi lên không phải JSON hợp lệ', 'BAD_JSON'); }
}
export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}
