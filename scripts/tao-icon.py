# Tạo bộ icon ứng dụng "Nhà trọ 44" (phong cách iOS: nền gradient tươi + kính mờ + ngôi nhà trắng + số 44).
# Chạy (tùy chọn, cần Python + Pillow + numpy):  python scripts/tao-icon.py
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
S = 2048  # vẽ lớn rồi thu nhỏ cho mịn
def lerp(a, b, t): return a + (b - a) * t
def gradient(size, stops):
    y, x = np.mgrid[0:size, 0:size]; t = ((x + y) / (2 * (size - 1))).astype(np.float32)
    out = np.zeros((size, size, 3), np.float32)
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (t >= t0) & (t <= t1); u = ((t - t0) / (t1 - t0))[..., None]
        out = np.where(m[..., None], np.array(c0) * (1 - u) + np.array(c1) * u, out)
    return Image.fromarray(out.astype(np.uint8), 'RGB').convert('RGBA')
def radial(size, cx, cy, r, color, alpha):
    y, x = np.mgrid[0:size, 0:size]; d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r; a = np.clip(1 - d, 0, 1) ** 1.6 * alpha
    arr = np.zeros((size, size, 4), np.uint8); arr[..., 0], arr[..., 1], arr[..., 2] = color; arr[..., 3] = (a * 255).astype(np.uint8); return Image.fromarray(arr, 'RGBA')
def build(scale=1.0):
    img = gradient(S, [(0, (14, 165, 233)), (0.5, (99, 102, 241)), (1, (236, 72, 153))])
    img = Image.alpha_composite(img, radial(S, S * 0.2, S * 0.1, S * 0.75, (255, 255, 255), 0.55))
    img = Image.alpha_composite(img, radial(S, S * 0.95, S * 1.0, S * 0.7, (255, 120, 200), 0.45))
    c = S / 2; k = scale
    def P(x, y): return (c + (x - 512) * 2 * k, c + (y - 512) * 2 * k)
    # ngôi nhà: mái + thân (vẽ trên lớp riêng để đổ bóng)
    house = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(house)
    d.rounded_rectangle([*P(262, 470), *P(762, 830)], radius=int(70 * k * 2), fill=(255, 255, 255, 255))           # thân
    tri = [(512, 205), (176, 492), (848, 492)]; cx0 = sum(x for x, _ in tri) / 3; cy0 = sum(y for _, y in tri) / 3; r0 = 34
    inner = [(cx0 + (x - cx0) * 0.90, cy0 + (y - cy0) * 0.90) for x, y in tri]                                       # mái bo tròn: tam giác thu nhỏ + viền tròn
    d.polygon([P(x, y) for x, y in inner], fill=(255, 255, 255, 255)); d.line([P(x, y) for x, y in inner + [inner[0]]], fill=(255, 255, 255, 255), width=int(r0 * 2 * k * 2), joint='curve')
    for x, y in inner: d.ellipse([P(x - r0, y - r0), P(x + r0, y + r0)], fill=(255, 255, 255, 255))
    d.rounded_rectangle([*P(655, 235), *P(735, 395)], radius=int(22 * k * 2), fill=(255, 255, 255, 255))             # ống khói
    shadow = house.copy().filter(ImageFilter.GaussianBlur(40 * k)); sh = Image.new('RGBA', (S, S), (30, 20, 90, 0)); sh.putalpha(shadow.split()[3].point(lambda v: int(v * 0.45)))
    img = Image.alpha_composite(img, sh.transform(sh.size, Image.AFFINE, (1, 0, 0, 0, 1, -28 * k)))
    img = Image.alpha_composite(img, house)
    # số 44 gradient trong thân nhà
    font = ImageFont.truetype('/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf', int(300 * k * 2)); txt = Image.new('L', (S, S), 0); td = ImageDraw.Draw(txt)
    bb = td.textbbox((0, 0), '44', font=font); tw, th = bb[2] - bb[0], bb[3] - bb[1]; cx, cy = P(512, 652); td.text((cx - tw / 2 - bb[0], cy - th / 2 - bb[1]), '44', font=font, fill=255)
    grad = gradient(S, [(0, (14, 165, 233)), (0.55, (99, 102, 241)), (1, (236, 72, 153))]); layer = Image.new('RGBA', (S, S), (0, 0, 0, 0)); layer.paste(grad, (0, 0), txt); img = Image.alpha_composite(img, layer)
    # cửa sổ nhỏ trên mái
    d2 = ImageDraw.Draw(img); d2.ellipse([*P(472, 330), *P(552, 410)], fill=(99, 102, 241, 255)); d2.ellipse([*P(490, 348), *P(534, 392)], fill=(186, 230, 253, 255))
    # lớp kính bóng phía trên (liquid glass)
    gloss = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(gloss); gd.ellipse([-S * 0.25, -S * 0.9, S * 1.25, S * 0.42], fill=(255, 255, 255, 46)); img = Image.alpha_composite(img, gloss)
    return img.convert('RGB')
def save(img, name, px): img.resize((px, px), Image.LANCZOS).save(f'public/{name}', optimize=True)
full = build(1.0); mask = build(0.78)
for name, px in [('apple-touch-icon.png', 180), ('apple-touch-icon-152.png', 152), ('apple-touch-icon-167.png', 167), ('icon-192.png', 192), ('icon-512.png', 512), ('favicon-32.png', 32)]: save(full, name, px)
save(mask, 'icon-maskable-512.png', 512)
print('Đã tạo icon trong thư mục public/')
