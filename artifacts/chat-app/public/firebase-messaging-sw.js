// Firebase Cloud Messaging Service Worker
// This file MUST live at /firebase-messaging-sw.js (root of the origin).
// It handles background push notifications when the app tab is not in focus.

importScripts("https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js");

// These values are safe to expose — they identify the Firebase project, not secrets.
// They are replaced at build time if you use Vite env vars in your config.
firebase.initializeApp({
  apiKey: self.__FIREBASE_API_KEY__ || "",
  authDomain: self.__FIREBASE_AUTH_DOMAIN__ || "",
  projectId: self.__FIREBASE_PROJECT_ID__ || "",
  storageBucket: self.__FIREBASE_STORAGE_BUCKET__ || "",
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ || "",
  appId: self.__FIREBASE_APP_ID__ || "",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title = "New message", body = "" } = payload.notification ?? {};
  self.registration.showNotification(title, {
    body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: payload.data?.roomId ?? "gather",
    data: { url: payload.data?.url ?? "/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(url) && "focus" in client) return client.focus();
        }
        return clients.openWindow(url);
      }),
  );
});
