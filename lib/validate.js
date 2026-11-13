import { bad } from './errors.js';
import { isValidISO } from './dates.js';
const s = (v, max = 200) => String(v ?? '').trim().slice(0, max);
// Số Zalo: để trống thì dùng số điện thoại
function zaloOf(p) { const z = s(p.zalo, 20).replace(/[\s.-]/g, '') || s(p.phone, 20).replace(/[\s.-]/g, ''); if (z && !/^\+?\d{8,15}$/.test(z)) throw bad('Số Zalo không hợp lệ (chỉ gồm chữ số)'); return z; }
export function cleanPerson(p, { full }, today) {
  const o = { fullName: s(p.fullName, 100), dob: s(p.dob, 10), gender: s(p.gender, 10), phone: s(p.phone, 20).replace(/[\s.-]/g, ''), cccd: s(p.cccd, 20).replace(/\s/g, ''), note: s(p.note, 300), zalo: zaloOf(p) };
  if (!o.fullName) throw bad('Chưa nhập họ và tên');
  if (!isValidISO(o.dob)) throw bad('Ngày sinh phải nhập đầy đủ ngày/tháng/năm');
  if (o.dob > today) throw bad('Ngày sinh không được ở tương lai');
  if (!['male', 'female', 'other'].includes(o.gender)) throw bad('Chưa chọn giới tính');
  if (o.phone && !/^\+?\d{8,15}$/.test(o.phone)) throw bad('Số điện thoại không hợp lệ');
  if (full) {
    if (!o.phone) throw bad('Chưa nhập số điện thoại');
    if (!/^(\d{9}|\d{12})$/.test(o.cccd)) throw bad('Số CCCD phải gồm 12 chữ số (hoặc CMND 9 số)');
    o.cccdIssueDate = s(p.cccdIssueDate, 10);
    if (!isValidISO(o.cccdIssueDate) || o.cccdIssueDate > today) throw bad('Ngày cấp CCCD không hợp lệ');
    o.cccdIssuePlace = s(p.cccdIssuePlace, 150); if (!o.cccdIssuePlace) throw bad('Chưa nhập nơi cấp CCCD');
    o.address = s(p.address, 250); if (!o.address) throw bad('Chưa nhập địa chỉ thường trú');
  } else if (o.cccd && !/^(\d{9}|\d{12})$/.test(o.cccd)) throw bad('Số CCCD của người ở cùng không hợp lệ');
  return o;
}
export const num = (v, name) => { const n = Number(v); if (!Number.isFinite(n)) throw bad(`${name} không hợp lệ`); return n; };
export const str = s;

export function cleanOccupant(p, today) {
  const o = { fullName: str(p.fullName, 100), dob: str(p.dob, 10), gender: str(p.gender, 10), phone: str(p.phone, 20).replace(/[\s.-]/g, ''), cccd: str(p.cccd, 20).replace(/\s/g, ''), note: str(p.note, 300), noId: !!p.noId, address: str(p.address, 250), zalo: zaloOf(p) };
  if (!o.fullName) throw bad('Chưa nhập họ tên người ở cùng');
  if (!isValidISO(o.dob) || o.dob > today) throw bad('Ngày sinh người ở cùng phải nhập đầy đủ ngày/tháng/năm');
  if (!['male', 'female', 'other'].includes(o.gender)) throw bad('Chưa chọn giới tính người ở cùng');
  if (o.phone && !/^\+?\d{8,15}$/.test(o.phone)) throw bad('Số điện thoại người ở cùng không hợp lệ');
  if (!o.noId && !/^(\d{9}|\d{12})$/.test(o.cccd)) throw bad('Số CCCD người ở cùng phải gồm 12 chữ số (tick "Chưa có CCCD" nếu là trẻ em)');
  if (o.noId) o.cccd = ''; else if (!o.address) throw bad('Chưa nhập địa chỉ thường trú của người ở cùng');
  return o;
}

export function cleanBank(b) {
  const bankName = str(b?.bankName, 80), accountNumber = str(b?.accountNumber, 30).replace(/[\s.-]/g, ''), accountName = str(b?.accountName, 80).toUpperCase();
  if (!bankName && !accountNumber && !accountName) return null; // xóa thông tin
  if (!bankName) throw bad('Chưa nhập tên ngân hàng'); if (!accountName) throw bad('Chưa nhập tên chủ tài khoản');
  if (!/^\d{6,20}$/.test(accountNumber)) throw bad('Số tài khoản chỉ gồm chữ số (6–20 số)');
  return { bankName, accountNumber, accountName };
}
