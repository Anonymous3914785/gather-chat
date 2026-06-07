---
name: Gather PWA + push setup
description: vite-plugin-pwa configuration, FCM service worker location, and what's needed for actual push delivery.
---

## PWA

- Uses `vite-plugin-pwa` in `artifacts/chat-app/vite.config.ts`.
- Manifest configured inline (name: Gather, theme: #e8522a, display: standalone).
- Icons: uses `favicon.svg` with `purpose: "any maskable"` — works on modern browsers.
  For iOS homescreen, proper 180×180 PNG apple-touch-icon is recommended.
- `devOptions: { enabled: false }` — SW only active in production build.

## FCM push notifications

Client-side setup is complete (`src/hooks/use-fcm.ts`):
1. Requests `Notification.permission`
2. Calls `getToken(messaging, { vapidKey })` from `firebase/messaging`
3. Stores token in `users/{uid}/fcmTokens/{tokenId}` in Firestore

**What the user still needs to do to activate push delivery:**
1. In Firebase console → Project settings → Cloud Messaging → Web Push certificates → generate a key pair.
2. Add `VITE_FIREBASE_VAPID_KEY=<key>` as a secret in the Replit environment.
3. Set up a server-side trigger (Firebase Cloud Functions or the API server with Admin SDK)
   that listens to `rooms/{roomId}/messages` and calls the FCM HTTP v1 API for all
   tokens in the room except the sender.

## Service worker

`artifacts/chat-app/public/firebase-messaging-sw.js` — must stay at root of origin.
Uses Firebase compat SDK (CDN importScripts) to avoid bundler complications with SW scope.
Handles `onBackgroundMessage` and `notificationclick` (focuses existing tab or opens new one).
