// Đọc số tiền thành chữ tiếng Việt kiểu văn bản hợp đồng: 1000000 -> "Một triệu không trăm ngàn đồng"
const D = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function read3(n, higher) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, u = n % 10; const out = [];
  if (h > 0 || (higher && n > 0)) out.push(`${D[h]} trăm`);
  if (t > 1) { out.push(`${D[t]} mươi`); if (u === 1) out.push('mốt'); else if (u === 5) out.push('lăm'); else if (u > 0) out.push(D[u]); }
  else if (t === 1) { out.push('mười'); if (u === 5) out.push('lăm'); else if (u > 0) out.push(D[u]); }
  else if (u > 0) { if (h > 0 || higher) out.push('linh'); out.push(D[u]); }
  return out.join(' ');
}
export function moneyWords(x) {
  let n = Math.round(Number(x) || 0); if (n <= 0) return 'Không đồng';
  const groups = []; while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const scale = ['', 'ngàn', 'triệu', 'tỷ']; const name = (i) => (i >= 3 ? Array(i - 2).fill('tỷ').join(' ') : scale[i]); const parts = [];
  let prevNonZero = false;
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) { // nhóm 000 ngay sau nhóm có số, và phía dưới vẫn còn số hoặc là nhóm ngàn/triệu: đọc "không trăm <đơn vị>"
      if (prevNonZero && i >= 1) parts.push(`không trăm ${name(i)}`); prevNonZero = false; continue;
    }
    parts.push(`${read3(g, i < groups.length - 1)} ${name(i)}`.trim()); prevNonZero = true;
  }
  const s = parts.join(' '); return `${s[0].toUpperCase()}${s.slice(1)} đồng`;
}
