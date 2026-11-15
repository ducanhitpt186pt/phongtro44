// Kiểm thử thông báo đẩy: mã hóa aes128gcm (RFC 8291) giải mã ngược được, chữ ký VAPID (ES256) đúng, gửi tới "máy chủ push" giả lập.
import crypto from 'node:crypto'; import http from 'node:http'; import assert from 'node:assert/strict';
import { ensureVapid, encryptPayload, sendPush, badgeSummary } from '../lib/push.js';
const b64u = (b) => Buffer.from(b).toString('base64url'); let pass = 0; const ok = (m) => { pass++; console.log('  ✓', m); };
// "trình duyệt" giả: cặp khóa p256dh + auth
const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16);
const sub = { endpoint: '', keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) } };
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
function decrypt(body) { // phía trình duyệt theo RFC 8291
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const shared = ua.computeSecret(asPub); const ikm = hmac(hmac(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub, Buffer.from([1])]));
  const prk = hmac(salt, ikm); const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16); const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16)); const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(pt[pt.length - 1], 2); return pt.subarray(0, -1).toString();
}
const db = { meta: {}, rentals: [], tenants: [], occupants: [], invoices: [], payments: [], rooms: [], debts: [], readings: [], priceHistories: [], checkoutRecords: [], masterReadings: [] };
ensureVapid(db); const v = db.meta.push.vapid; assert.equal(Buffer.from(v.publicKey, 'base64url').length, 65); assert.equal(ensureVapid(db), false); ok('tự tạo khóa VAPID 1 lần (khóa công khai 65 byte)');
{ const as = crypto.createECDH('prime256v1'); as.setPrivateKey(Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', 'base64url'));
  const out = encryptPayload({ keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' } }, 'When I grow up, I want to be a watermelon', { salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url'), ecdh: as }).toString('base64url');
  assert.equal(out, 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'); ok('khớp từng byte với ví dụ chuẩn RFC 8291 (Phụ lục A)'); }
assert.equal(decrypt(encryptPayload(sub, 'Xin chào 44')), 'Xin chào 44'); ok('nội dung mã hóa aes128gcm giải mã ngược đúng (tiếng Việt)');
// máy chủ push giả: kiểm tra header + chữ ký, giải mã nội dung
let got = null; let reply = 201;
const srv = http.createServer((req, res) => { const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => { got = { h: req.headers, body: Buffer.concat(ch) }; res.statusCode = reply; res.end(); }); });
await new Promise((r) => srv.listen(4999, r)); sub.endpoint = 'http://localhost:4999/push/abc';
const r1 = await sendPush(v, sub, { title: 'Nhà trọ 44', body: 'Có 3 việc', badge: 3 }, 'https://phongtro44.vercel.app');
assert.equal(r1.ok, true); assert.equal(got.h['content-encoding'], 'aes128gcm'); assert.equal(got.h.ttl, '86400');
const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(got.h.authorization); assert.ok(m); assert.equal(m[4], v.publicKey);
const claims = JSON.parse(Buffer.from(m[2], 'base64url')); assert.equal(claims.aud, 'http://localhost:4999'); assert.equal(claims.sub, 'https://phongtro44.vercel.app'); assert.ok(claims.exp > Date.now() / 1000);
const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: v.jwk.x, y: v.jwk.y }, format: 'jwk' });
assert.ok(crypto.verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url'))); ok('chữ ký VAPID ES256 hợp lệ, đúng aud/sub/exp');
assert.deepEqual(JSON.parse(decrypt(got.body)), { title: 'Nhà trọ 44', body: 'Có 3 việc', badge: 3 }); ok('máy chủ push nhận được và giải mã đúng nội dung (badge = 3)');
reply = 410; const r2 = await sendPush(v, sub, { a: 1 }, 'https://x'); assert.equal(r2.gone, true); ok('máy đã gỡ app (410) được nhận biết để xóa khỏi danh sách');
srv.close();
const s0 = badgeSummary(db, '2026-11-15'); assert.equal(s0.count, 0); assert.match(s0.body, /Không còn việc/); ok('không có việc → số 0, nội dung "Không còn việc cần xử lý"');
console.log(`\nThông báo đẩy: ${pass} đạt`);
