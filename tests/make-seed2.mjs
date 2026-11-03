// Dữ liệu mẫu để kiểm thử giao diện: 2 khách đang thuê giữa kỳ.  node tests/make-seed2.mjs > /tmp/seed2.json
import { emptyDb } from '../lib/schema.js'; import * as B from '../lib/billing.js';
const db = emptyDb('2026-01-01'); const base = { dob: '1990-01-01', gender: 'male', cccd: '001090000001', cccdIssueDate: '2020-01-01', cccdIssuePlace: 'HN', address: 'Hà Nội' };
const t0 = '2026-11-03';
const a = B.moveIn(db, { mode: 'existing', paidAlready: true, roomId: 'room-1', startDate: '2026-10-20', rent: 1200000, elecPrice: 3000, waterPrice: 10000, initElec: 100, initWater: 10, tenant: { ...base, fullName: 'Khách Một', phone: '0900000001' } }, t0);
const b = B.moveIn(db, { mode: 'existing', roomId: 'room-2', startDate: '2026-10-25', rent: 1500000, elecPrice: 3500, waterPrice: 12000, initElec: 50, initWater: 5, tenant: { ...base, fullName: 'Khách Hai', phone: '0900000002', cccd: '001090000002' } }, t0);
console.log(JSON.stringify(db));
