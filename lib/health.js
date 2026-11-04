// Dòng trạng thái hệ thống: luôn có % dung lượng ảnh; chỉ thêm cảnh báo khi thực sự có vấn đề với GitHub/Vercel.
import { diffDays } from './dates.js';
import { dmyText } from './fmt.js';

export function buildSystem({ today, tokenExpires, storage, db = { name: 'redis', configured: true }, usage = null }) {
  const alerts = [];
  if (tokenExpires) {
    const left = diffDays(today, tokenExpires);
    if (left < 0) alerts.push({ level: 'red', text: `GitHub Token đã hết hạn từ ${dmyText(tokenExpires)}. Website sẽ không lưu được dữ liệu – cần tạo token mới.` });
    else if (left <= 30) alerts.push({ level: 'orange', text: `GitHub Token sắp hết hạn: còn ${left} ngày (${dmyText(tokenExpires)}). Hãy tạo token mới trước hạn.` });
  }
  if (!db.configured) alerts.push({ level: 'red', text: `Chưa kết nối nơi lưu dữ liệu (${{ redis: 'Upstash Redis', blob: 'Vercel Blob', github: 'GitHub' }[db.name]}) – web chưa lưu được dữ liệu.` });
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.E2E_FAKE_BLOB) alerts.push({ level: 'red', text: 'Chưa kết nối kho ảnh Vercel Blob – chưa lưu được ảnh CCCD.' });
  let upstash = null;
  if (usage && usage.commands != null) {
    const cmdPct = Math.round((usage.commands / usage.commandLimit) * 1000) / 10;
    const dbPct = usage.dbBytes != null ? Math.round((usage.dbBytes / usage.dbLimitBytes) * 10000) / 100 : 0;
    upstash = { commands: usage.commands, commandLimit: usage.commandLimit, commandPct: cmdPct, dbKb: Math.round((usage.dbBytes || 0) / 102.4) / 10, dbLimitMb: Math.round(usage.dbLimitBytes / 1048576), dbPct };
    const worst = Math.max(cmdPct, dbPct);
    if (worst >= 95) alerts.push({ level: 'red', text: `Upstash gần chạm hạn mức gói miễn phí (${worst}%). Khi đầy, web sẽ không lưu được dữ liệu.` });
    else if (worst >= 80) alerts.push({ level: 'orange', text: `Upstash đã dùng ${worst}% hạn mức gói miễn phí tháng này.` });
  }
  return { upstash, storagePct: storage.pct, storageUsedMb: Math.round((storage.usedBytes / 1048576) * 10) / 10, storageLimitMb: Math.round(storage.limitBytes / 1048576), alerts };
}
