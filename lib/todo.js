// MỘT cách đếm duy nhất cho "số việc cần làm": dùng chung cho chuông trong app, chuông trang ngoài, số trên biểu tượng app và thông báo mỗi sáng.
// Chỉ đếm việc LÀM ĐƯỢC và sẽ HẾT khi làm xong. Mỗi phòng: trước 7 ngày = 1 việc GHI ĐIỆN NƯỚC (gồm sắp thu tiền); ghi xong = 1 việc THU TIỀN; thu đủ = hết.
import { buildReminders } from './reminders.js';
import { usageOverview } from './usage.js';
import { remainingOf as debtRemaining } from './debts.js';
import { suspiciousPhone } from './validate.js';

export function todoSummary(db, today, reminders = buildReminders(db, today), usage = usageOverview(db, today)) {
  const tk = (k) => reminders.filter((r) => (r.tasks || []).includes(k)).length;
  const readings = tk('readings'), unpaid = tk('pay'), refunds = tk('refund'); const roomTasks = readings + unpaid + refunds;
  const alerts = usage.alerts.length; // nghi rò rỉ điện/nước – hết khi bấm "Đã kiểm tra"
  const debts = (db.debts || []).filter((d) => debtRemaining(d) > 0).length; // Nhắc Nợ (Cần Thu + Cần Trả) – hết khi thu/trả xong
  let oldDebts = 0, phones = 0;
  for (const r of db.rentals.filter((x) => x.status === 'active')) {
    const t = db.tenants.find((x) => x.id === r.tenantId); if (!t || t.purgedAt) continue;
    if (t.oldDebt?.amount > 0) oldDebts++; // hết khi bấm "Đã thu hết"
    if (suspiciousPhone(t.phone) && t.phoneOk !== t.phone) phones++; // hết khi sửa số hoặc bấm "Số đúng"
    for (const o of db.occupants.filter((x) => x.tenantId === t.id)) if (suspiciousPhone(o.phone) && o.phoneOk !== o.phone) phones++;
  }
  const count = roomTasks + alerts + debts + oldDebts + phones;
  return { count, rooms: roomTasks, alerts, debts, oldDebts, phones, unpaid, readings, refunds };
}
// Câu tóm tắt cho thông báo mỗi sáng
export function todoText(t) {
  const parts = [t.readings && `${t.readings} phòng cần ghi điện nước`, t.unpaid && `${t.unpaid} phòng cần thu tiền`, t.refunds && `${t.refunds} khoản cần hoàn tiền`, t.debts && `${t.debts} khoản Nhắc Nợ`, t.oldDebts && `${t.oldDebts} khách còn nợ cũ`, t.phones && `${t.phones} số điện thoại cần cập nhật`, t.alerts && `${t.alerts} cảnh báo điện nước`].filter(Boolean);
  return t.count ? `Có ${t.count} việc cần xử lý: ${parts.join(', ')}.` : 'Không còn việc cần xử lý. Chúc một ngày tốt lành!';
}
