// Service worker CHỈ để nhận thông báo đẩy (không lưu bộ nhớ đệm trang, nên cập nhật web không bị kẹt bản cũ).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  const n = Number(d.badge) || 0;
  const badge = 'setAppBadge' in self.navigator ? (n > 0 ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge()).catch(() => {}) : Promise.resolve();
  e.waitUntil(Promise.all([badge, self.registration.showNotification(d.title || 'Nhà trọ 44', { body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag || 'nt44', renotify: true, data: { url: d.url || '/#/dashboard' } })]));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); const url = e.notification.data?.url || '/#/dashboard';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => { for (const c of list) { if ('focus' in c) { c.navigate?.(url); return c.focus(); } } return self.clients.openWindow(url); }));
});
