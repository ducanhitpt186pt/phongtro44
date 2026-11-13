# Tạo public/js/icons.js từ bộ icon MIỄN PHÍ Material Design Icons (Pictogrammers, giấy phép Apache 2.0).
# Chạy (tùy chọn): python scripts/tao-bo-icon.py  (cần thư mục icon .svg của Material Design Icons)
import re, sys, os
SRC = os.environ.get('MDI_DIR', '/usr/local/lib/python3.12/dist-packages/material/templates/.icons/material')
# tên dùng trong web : (tên file MDI, màu mặc định)
ICONS = {
 'home': ('home', 'blue'), 'bed': ('bed', 'blue'), 'door-closed': ('door-closed', 'gray'), 'door-open': ('door-open', 'green'), 'key': ('key-variant', 'amber'),
 'wrench': ('wrench', 'red'), 'clock': ('clock-outline', 'gray'), 'lock': ('lock', 'gray'), 'user': ('account', 'indigo'), 'users': ('account-multiple', 'indigo'),
 'bell': ('bell', 'amber'), 'bolt': ('lightning-bolt', 'amber'), 'drop': ('water', 'sky'), 'storage': ('database', 'violet'), 'camera': ('camera', 'pink'),
 'photo': ('image', 'teal'), 'plus': ('plus', ''), 'card': ('card-account-details', 'indigo'), 'money': ('cash', 'green'), 'swap': ('swap-horizontal', 'blue'),
 'trash': ('delete', 'red'), 'chart': ('chart-bar', 'violet'), 'shield': ('shield-check', 'green'), 'alert': ('alert', 'orange'), 'check': ('check-circle', 'green'),
 'rotate': ('rotate-right', 'blue'), 'calendar': ('calendar-month', 'rose'), 'star': ('star', 'amber'), 'edit': ('pencil', 'blue'), 'chevL': ('chevron-left', ''),
 'chevR': ('chevron-right', ''), 'sheet': ('file-table', 'green'), 'chat': ('message-text', 'blue'), 'login': ('login', ''), 'bank': ('bank', 'teal'),
 'tools': ('tools', 'orange'), 'phone': ('phone-outline', 'green'), 'calendar-plus': ('calendar-plus', 'rose'), 'close': ('close', ''), 'info': ('information', 'blue'),
}
out = ['// Bộ icon: Material Design Icons (Pictogrammers) – miễn phí, giấy phép Apache 2.0 (xem public/vendor/ICONS-LICENSE.txt).', '// File này được tạo bởi scripts/tao-bo-icon.py – đừng sửa tay.', "import { raw } from './util.js';", 'const P = {']
for name, (f, col) in ICONS.items():
    svg = open(os.path.join(SRC, f + '.svg'), encoding='utf8').read(); d = re.search(r'\sd="([^"]+)"', svg).group(1)
    out.append(f"  '{name}': ['{d}', '{col}'],")
out.append('};')
out.append('''// Trả về HTML an toàn (Raw) nên dùng trực tiếp trong mẫu html`` mà không bị thoát ký tự. plain=true: dùng màu chữ hiện tại.
export const icon = (name, size = '1em', extra = '', plain = false) => { const p = P[name] || ['', '']; return raw(`<svg class="ic ${extra}" ${p[1] && !plain ? `data-c="${p[1]}"` : ''} width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${p[0]}"/></svg>`); };
export const ROOM_ICON = { occupied: 'bed', empty: 'door-open', repair: 'wrench', notready: 'lock', owner: 'home' };
export const ROOM_TONE = { occupied: 'blue', empty: 'green', repair: 'red', notready: 'gray', owner: 'orange' };''')
open('public/js/icons.js', 'w', encoding='utf8').write('\n'.join(out) + '\n')
print('Đã tạo public/js/icons.js với', len(ICONS), 'icon')
