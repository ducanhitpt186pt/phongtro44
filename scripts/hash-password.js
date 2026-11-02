// Tùy chọn nâng cao: tạo APP_PASSWORD_HASH. Chạy:  node scripts/hash-password.js "matkhau-cua-ban"
import crypto from 'node:crypto';
const pw = process.argv[2]; if (!pw) { console.log('Cách dùng: node scripts/hash-password.js "mật khẩu"'); process.exit(1); }
const salt = crypto.randomBytes(16);
console.log(`scrypt$${salt.toString('hex')}$${crypto.scryptSync(pw, salt, 32).toString('hex')}`);
