// Tạo dữ liệu mẫu có khách trả phòng từ 2023 để thử chức năng dọn dữ liệu.  node tests/make-seed.mjs > /tmp/seed.json
import { emptyDb } from '../lib/schema.js'; import * as B from '../lib/billing.js';
const db = emptyDb('2023-01-01'); const p = { fullName: 'Khách Cũ Ba Năm', dob: '1980-01-01', gender: 'male', phone: '0900000001', cccd: '001080000001', cccdIssueDate: '2020-01-01', cccdIssuePlace: 'HN', address: 'Hà Nội' };
const a = B.moveIn(db, { roomId: 'room-1', startDate: '2023-01-10', rent: 1000000, elecPrice: 3000, waterPrice: 10000, initElec: 0, initWater: 0, tenant: p }, '2023-01-10');
B.addPayment(db, { invoiceId: a.invoice.id, amount: 1000000 }, '2023-01-10');
const c = B.confirmCheckout(db, { rentalId: a.rental.id, date: '2023-01-20', elecFinal: 10, waterFinal: 1 }, '2023-01-20');
if (c.record.refund) B.markRefunded(db, c.record.id, '2023-01-21', '2023-01-21');
db.tenants[0].idImages.front = { id: 'img-old-f', pathname: 'cccd/old/front.jpg', side: 'front', contentType: 'image/jpeg', size: 900000, uploadedAt: '2023-01-10T00:00:00Z' };
db.tenants[0].idImages.back = { id: 'img-old-b', pathname: 'cccd/old/back.jpg', side: 'back', contentType: 'image/jpeg', size: 900000, uploadedAt: '2023-01-10T00:00:00Z' };
console.log(JSON.stringify(db));
