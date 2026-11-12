// Dữ liệu mẫu 10 tháng điện nước + đồng hồ tổng.  node tests/make-seed3.mjs > /tmp/seed3.json
import { emptyDb } from '../lib/schema.js'; import * as B from '../lib/billing.js'; import { periodStart } from '../lib/dates.js';
const db = emptyDb('2026-01-01'); const start = '2026-01-10';
const m = B.moveIn(db, { roomId: 'room-1', startDate: start, rent: 1000000, elecPrice: 3000, waterPrice: 10000, initElec: 1000, initWater: 100, tenant: { fullName: 'Khách Điện Nước', dob: '1990-01-01', gender: 'male', phone: '0900000003', cccd: '001090000003', cccdIssueDate: '2020-01-01', cccdIssuePlace: 'HN', address: 'HN' } }, start);
B.addPayment(db, { invoiceId: m.invoice.id, amount: m.invoice.total }, start);
let e = 1000, w = 100; const el = [50, 50, 50, 50, 50, 50, 50, 50, 50, 80], wa = [10, 10, 10, 10, 10, 10, 10, 10, 10, 5];
el.forEach((u, i) => { e += u; w += wa[i]; const d0 = periodStart(start, i + 1); const inv = B.createPeriodicInvoice(db, { rentalId: m.rental.id, periodIndex: i + 1, elecNew: e, waterNew: w }, d0); B.addPayment(db, { invoiceId: inv.id, amount: inv.total }, d0); });
let me = 5000, mw = 500; const mo = [40, 40, 40, 40, 40, 40, 40, 40, 40, 90]; // chủ nhà dùng thêm ngoài phòng 1 (các phòng khác trống)
db.masterReadings.push({ id: 'mr0', date: start, elec: me, water: mw, note: '', createdAt: '' });
el.forEach((u, i) => { me += u + mo[i]; mw += wa[i] + 4; db.masterReadings.push({ id: 'mr' + (i + 1), date: periodStart(start, i + 1), elec: me, water: mw, note: '', createdAt: '' }); });
console.log(JSON.stringify(db));
