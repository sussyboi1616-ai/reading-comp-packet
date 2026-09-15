/* THE VAULT — minimal service worker for reliable desktop notifications on Chromium/Windows. */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', function (event) {
  var tag = (event.notification && event.notification.tag) || '';
  try { event.notification.close(); } catch (e) {}
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      var focusPromise = null;
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        try {
          client.postMessage({ type: 'vault-notif-click', tag: tag });
        } catch (e2) {}
        if (!focusPromise && 'focus' in client) {
          focusPromise = client.focus();
        }
      }
      if (focusPromise) return focusPromise;
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
