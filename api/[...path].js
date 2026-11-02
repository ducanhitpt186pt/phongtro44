// Một Function duy nhất xử lý toàn bộ /api/* (gói Hobby của Vercel giới hạn 12 Function).
import { entry } from '../lib/router.js';
export default function handler(req, res) { return entry(req, res); }
