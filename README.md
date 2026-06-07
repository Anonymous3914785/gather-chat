# Gather

> Where small teams actually talk.

A real-time group chat app built with React, Firebase, and Tailwind CSS. Features multi-room chat, presence indicators, image sharing, emoji reactions, and PWA install support — all powered directly by Firebase from the frontend.

---

## Features

- 🔐 **Auth** — Email/password sign-up and sign-in via Firebase Auth
- 💬 **Multi-room chat** — Create and join unlimited rooms; last message preview + timestamps in sidebar
- 🟢 **Presence** — Real-time online/offline indicators and "X online now" count
- 🖼️ **Images** — Send photos inline; stored in Firebase Storage
- 😂 **Reactions** — Hover (or long-press on mobile) any message to react with 👍 ❤️ 😂 😮 😢 🔥
- ✏️ **Edit & delete** — Right-click or long-press your own messages; delete has a confirmation modal; edited messages show an *edited* label
- 🔔 **Unread badges** — Orange dot + last-message preview for rooms with unseen messages
- 👤 **Profile pictures** — Click your avatar to upload a photo; synced everywhere instantly
- 📱 **Mobile PWA** — Installable from Chrome/Edge; standalone display; offline asset caching
- 🔔 **Push notifications** — FCM infrastructure ready (see setup below)

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 7 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Routing | Wouter |
| Backend | Firebase Auth, Firestore, Storage (client-side only) |
| Monorepo | pnpm workspaces |
| Language | TypeScript 5.9 |
| PWA | vite-plugin-pwa + Workbox |

---

## Project Structure

```
artifacts/
  chat-app/          # React + Vite frontend (main app)
  api-server/        # Express API server (reserved for server-side features)
  mockup-sandbox/    # Component preview sandbox (dev only)
lib/                 # Shared TypeScript libraries
firestore.rules      # Firestore security rules
storage.rules        # Firebase Storage security rules
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Firebase project with Auth, Firestore, and Storage enabled

### Environment Variables

Create the following secrets (or a `.env` file for local dev — never commit it):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=   # Optional: enables push notifications
```

### Install & Run

```bash
pnpm install
pnpm --filter @workspace/chat-app run dev
```

---

## Firebase Setup

### 1. Firestore Security Rules

Copy `firestore.rules` into Firebase console → Firestore → Rules.

Key rules:
- Only authenticated users can read/write
- Users can only write messages with their own `uid`
- Reactions are the only field other users can update on a message
- User profiles are publicly readable but privately writable

### 2. Storage Security Rules

Copy `storage.rules` into Firebase console → Storage → Rules.

- Avatars: `avatars/{uid}.*` — owner-only write, max 5 MB
- Message images: `message-images/{roomId}/{imageId}` — any auth user, max 20 MB

### 3. Push Notifications (optional)

1. Firebase console → Project settings → Cloud Messaging → Web Push certificates → Generate key pair
2. Add the public key as `VITE_FIREBASE_VAPID_KEY`
3. Deploy a Cloud Function (or use the API server) to call the FCM HTTP v1 API when a new message is created — tokens are stored in Firestore under `users/{uid}/fcmTokens/`

---

## Firestore Data Model

```
rooms/{roomId}
  name: string
  createdAt: Timestamp
  createdBy: uid
  lastMessage: { text?, imageURL?, uid, email, createdAt }

rooms/{roomId}/messages/{msgId}
  text?: string
  imageURL?: string
  uid: string
  email: string
  createdAt: Timestamp
  editedAt?: Timestamp
  reactions?: { [emoji]: { [uid]: true } }

users/{uid}
  online: boolean
  lastSeen: Timestamp
  email: string
  photoURL?: string
  uid: string

users/{uid}/roomActivity/{roomId}
  lastSeen: Timestamp

users/{uid}/fcmTokens/{tokenId}
  token: string
  createdAt: Timestamp
  userAgent: string
```

---

## Scripts

```bash
pnpm run typecheck          # Full typecheck across all packages
pnpm run build              # Typecheck + build all packages
pnpm --filter @workspace/db run push   # Push DB schema (if using Drizzle)
```

---

## Deployment

Deploy the chat app to any static host (Vercel, Netlify, Firebase Hosting) or use [Replit Deployments](https://replit.com/deployments).

```bash
pnpm --filter @workspace/chat-app run build
# Output: artifacts/chat-app/dist/public/
```

---

## License

MIT
deploy fix
