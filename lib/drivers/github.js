// Tùy chọn: nơi lưu database.json = repo GitHub PRIVATE (cần GITHUB_TOKEN, token này có thể có hạn).
import { cfg } from '../config.js';
import { ApiError } from '../errors.js';
const API = 'https://api.github.com';
const headers = (extra = {}) => ({ Authorization: `Bearer ${cfg.ghToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'nha-tro-44', ...extra });
const url = (path) => `${API}/repos/${cfg.ghOwner}/${cfg.ghRepo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let expiry = null;
export const name = 'github';
export const tokenExpiry = () => expiry;
async function gh(u, opts = {}, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(u, { ...opts, headers: headers(opts.headers) });
      if (res.status >= 500 || res.status === 429) { last = new Error(`GitHub ${res.status}`); await sleep(400 * (i + 1)); continue; }
      const exp = res.headers.get('github-authentication-token-expiration');
      if (exp) { const t = Date.parse(exp.replace(' UTC', 'Z').replace(' ', 'T')); if (!Number.isNaN(t)) expiry = new Date(t).toISOString().slice(0, 10); }
      return res;
    } catch (e) { last = e; await sleep(400 * (i + 1)); }
  }
  throw new ApiError(502, 'Không kết nối được GitHub để lưu/đọc dữ liệu. Dữ liệu CHƯA được lưu, hãy thử lại.', 'GITHUB_DOWN', { cause: String(last?.message || last) });
}
const authFail = (res) => { if (res.status === 401 || res.status === 403) throw new ApiError(500, 'GitHub từ chối quyền truy cập. Kiểm tra GITHUB_TOKEN (hết hạn hoặc thiếu quyền Contents: Read and write).', 'GITHUB_AUTH'); };
async function readRaw(path) {
  const res = await gh(`${url(path)}?ref=${encodeURIComponent(cfg.ghBranch)}`, { headers: { 'Cache-Control': 'no-cache' } });
  if (res.status === 404) return { exists: false, version: null, text: null };
  authFail(res);
  if (!res.ok) throw new ApiError(502, `GitHub trả lỗi ${res.status} khi đọc dữ liệu`, 'GITHUB_READ');
  const j = await res.json(); let b64 = j.content;
  if (!b64 || j.encoding === 'none') { const br = await gh(`${API}/repos/${cfg.ghOwner}/${cfg.ghRepo}/git/blobs/${j.sha}`); if (!br.ok) throw new ApiError(502, 'Không đọc được file dữ liệu lớn', 'GITHUB_READ'); b64 = (await br.json()).content; }
  return { exists: true, version: j.sha, text: Buffer.from(b64, 'base64').toString('utf8') };
}
async function writeRaw(path, text, sha, message) {
  const body = { message, content: Buffer.from(text, 'utf8').toString('base64'), branch: cfg.ghBranch }; if (sha) body.sha = sha;
  const res = await gh(url(path), { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, 2);
  if (res.status === 409 || res.status === 422) return { conflict: true };
  authFail(res);
  if (!res.ok) throw new ApiError(502, `GitHub trả lỗi ${res.status} khi ghi dữ liệu. Dữ liệu CHƯA được lưu.`, 'GITHUB_WRITE');
  return { ok: true };
}
export const readDb = () => readRaw(cfg.dbPath);
export const writeDb = (text, version) => writeRaw(cfg.dbPath, text, version, 'Cập nhật dữ liệu');
export async function putExtra(path, text) { const ex = await readRaw(path); if (ex.exists) return false; const w = await writeRaw(path, text, null, `Sao lưu: ${path}`); return !!w.ok; }
export async function listExtra(prefix) {
  const res = await gh(`${url(prefix.replace(/\/$/, ''))}?ref=${encodeURIComponent(cfg.ghBranch)}`); if (!res.ok) return [];
  return (await res.json()).map((f) => ({ name: f.name, ref: { path: f.path, sha: f.sha } }));
}
export async function delExtra(ref) { await gh(url(ref.path), { method: 'DELETE', body: JSON.stringify({ message: 'Xóa bản sao lưu cũ', sha: ref.sha, branch: cfg.ghBranch }), headers: { 'Content-Type': 'application/json' } }, 1); }
