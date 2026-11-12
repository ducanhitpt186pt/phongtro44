// Bộ icon nét tròn (phong cách SF Symbols của iOS), tự vẽ bằng SVG – không cần tải thêm font/biểu tượng.
const P = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.5"/><path d="M10 20v-5h4v5"/>',
  bed: '<path d="M3 18V7"/><path d="M3 14h18v4"/><path d="M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>',
  'door-closed': '<rect x="6" y="3.5" width="12" height="17" rx="2"/><circle cx="15" cy="12.5" r=".9" fill="currentColor"/>',
  'door-open': '<path d="M6 20.5V5.5a2 2 0 0 1 1.7-2l7-1.1a1.5 1.5 0 0 1 1.8 1.5v16.6"/><path d="M4 20.5h16"/><circle cx="13" cy="12.5" r=".9" fill="currentColor"/>',
  key: '<circle cx="8" cy="15.5" r="3.6"/><path d="m10.6 12.9 8-8"/><path d="m15.5 7.9 2.3 2.3"/><path d="m17.8 5.6 1.8 1.8"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5l-2 .3L8.4 20.9a2.1 2.1 0 0 1-3-3L14.5 8.4l.2-2.1Z"/><path d="m15 9 .1-.1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5"/>',
  users: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19.5c.5-3.2 2.8-5 5.5-5s5 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16.5 14.6c2.3.1 3.8 1.5 4.2 4"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  bolt: '<path d="m13 3-8 11h6l-1 7 8-11h-6l1-7Z"/>',
  drop: '<path d="M12 3.5s6 6.2 6 10.3a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5Z"/>',
  storage: '<ellipse cx="12" cy="6.500" rx="7" ry="2.800"/><path d="M5 6.500v5c0 1.500 3.100 2.800 7 2.800s7-1.300 7-2.800v-5"/><path d="M5 11.500v5c0 1.500 3.100 2.800 7 2.800s7-1.300 7-2.800v-5"/>',
  camera: '<path d="M4 8.500A1.500 1.500 0 0 1 5.500 7h2l1.300-2h6.400L16.500 7h2A1.500 1.500 0 0 1 20 8.500v9a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 17.500v-9Z"/><circle cx="12" cy="13" r="3.400"/>',
  photo: '<rect x="3.500" y="4.500" width="17" height="15" rx="2.500"/><circle cx="9" cy="10" r="1.600"/><path d="m4 17 5-4.500 3.500 3 3-2.500L20 16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  card: '<rect x="3" y="5.500" width="18" height="13" rx="2.500"/><circle cx="8.500" cy="11" r="1.800"/><path d="M5.800 16c.5-1.600 1.500-2.300 2.700-2.300s2.200.7 2.700 2.300M14 10h4M14 13.500h3"/>',
  money: '<rect x="3" y="6.500" width="18" height="11" rx="2.500"/><circle cx="12" cy="12" r="2.600"/><path d="M6.500 9.500v.1M17.500 14.500v.1"/>',
  swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  trash: '<path d="M5 7h14M10 7V4.500h4V7M7 7l.8 12.500h8.400L17 7"/>',
  chart: '<path d="M5 20V10M12 20V5M19 20v-7"/>',
  shield: '<path d="M12 3.500 5 6v5.500c0 4.200 2.900 7.200 7 9 4.100-1.800 7-4.800 7-9V6l-7-2.500Z"/><path d="m9 12 2.200 2.200L15.200 10"/>',
  alert: '<path d="M12 4 2.800 19.500h18.400L12 4Z"/><path d="M12 10v4.500M12 17.200v.1"/>',
  check: '<circle cx="12" cy="12" r="8.500"/><path d="m8.500 12.200 2.500 2.500 4.500-5"/>',
  rotate: '<path d="M19 12a7 7 0 1 1-2.100-5"/><path d="M19 4.500v4h-4"/>',
  star: '<path d="m12 3.800 2.600 5.300 5.800.800-4.200 4.100 1 5.800L12 17l-5.200 2.800 1-5.800-4.200-4.100 5.800-.800L12 3.800Z"/>',
  edit: '<path d="M4 20h4L19 9a2.800 2.800 0 0 0-4-4L4 16v4Z"/><path d="m13.500 6.500 4 4"/>',
  chevL: '<path d="m14.500 6-6 6 6 6"/>',
  chevR: '<path d="m9.500 6 6 6-6 6"/>',
  sheet: '<rect x="4" y="3.500" width="16" height="17" rx="2.500"/><path d="M4 9h16M4 14.500h16M10 9v11.500"/>',
  calendar: '<rect x="4" y="5.500" width="16" height="14.500" rx="2.500"/><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4"/>',
};
export const icon = (name, size = '1em', extra = '') => `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
// biểu tượng + tên + màu theo trạng thái phòng
export const ROOM_ICON = { occupied: 'bed', empty: 'door-open', repair: 'wrench', notready: 'clock' };
export const ROOM_TONE = { occupied: 'blue', empty: 'green', repair: 'orange', notready: 'gray' };
// (bổ sung) biểu tượng cho lịch/sự kiện/Google Sheet
