// KrishiMitra Service Worker — Push Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for push events from the server
self.addEventListener("push", (event) => {
  let data = {
    title: "KrishiMitra AI",
    body: "You have a new notification!",
    icon: "/krishimitra.png",
    badge: "/krishimitra.png",
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    // If JSON parse fails, try text
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/krishimitra.png",
    badge: data.badge || "/krishimitra.png",
    vibrate: [100, 50, 100],
    requireInteraction: true,
    data: {
      url: data.url || "/",
      dateOfArrival: Date.now(),
    },
    actions: data.actions || [
      { action: "open", title: "Open KrishiMitra" },
      { action: "close", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  if (event.action === "close") return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(urlToOpen);
      })
  );
});
