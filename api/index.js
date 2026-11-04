// Cổng vào API (không dùng ngoặc vuông trong tên file để upload GitHub không bị lỗi).
// vercel.json chuyển mọi đường dẫn /api/* về file này.
import { entry } from '../lib/router.js';
export default function handler(req, res) { return entry(req, res); }
