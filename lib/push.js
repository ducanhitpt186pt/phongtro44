// Thông báo đẩy (Web Push) – không cần thư viện ngoài: khóa VAPID (ES256) + mã hóa nội dung aes128gcm (RFC 8291) bằng node:crypto.
// Dùng để mỗi sáng gửi 1 tin lên màn hình khóa và cập nhật SỐ trên biểu tượng ứng dụng kể cả khi app đang đóng.
import crypto from 'node:crypto';
import { todoSummary, todoText } from './todo.js';

const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// Khóa VAPID: tự tạo 1 lần, lưu trong db.meta.push (không bắt chủ nhà nhập biến môi trường)
export function ensureVapid(db) {
  db.meta = db.meta || {}; const p = (db.meta.push ||= { subs: [] }); p.subs ||= [];
  if (!p.vapid) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = privateKey.export({ format: 'jwk' }); const pub = publicKey.export({ format: 'jwk' });
    p.vapid = { publicKey: b64u(Buffer.concat([Buffer.from([4]), unb64u(pub.x), unb64u(pub.y)])), jwk: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }, createdAt: new Date().toISOString() };
    return true;
  }
  return false;
}
function vapidAuth(vapid, endpoint, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' })); const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const key = crypto.createPrivateKey({ key: vapid.jwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${vapid.publicKey}`;
}
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
// Mã hóa nội dung theo RFC 8291 (aes128gcm). Trả về Buffer thân request.
export function encryptPayload(sub, payload, { salt = crypto.randomBytes(16), ecdh = null } = {}) {
  const uaPub = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  const as = ecdh || crypto.createECDH('prime256v1'); if (!ecdh) as.generateKeys(); const asPub = as.getPublicKey();
  const shared = as.computeSecret(uaPub);
  const ikm = hmac(hmac(authSecret, shared), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce); const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header, 0); header.writeUInt32BE(4096, 16); header.writeUInt8(asPub.length, 20);
  return Buffer.concat([header, asPub, ct]);
}
export async function sendPush(vapid, sub, payload, subject) {
  const res = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: vapidAuth(vapid, sub.endpoint, subject), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' }, body: encryptPayload(sub, JSON.stringify(payload)) });
  return { status: res.status, gone: res.status === 404 || res.status === 410, ok: res.status >= 200 && res.status < 300, text: res.ok ? '' : (await res.text().catch(() => '')).slice(0, 200) };
}

// Số việc cần xử lý = đúng số trên chuông (dùng chung todoSummary)
export function badgeSummary(db, today) { const t = todoSummary(db, today); return { count: t.count, body: todoText(t) }; }
