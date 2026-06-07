---
name: Gather chat data model
description: Firestore collections, reaction storage pattern, and denormalized lastMessage on room docs.
---

## Firestore structure

- `rooms/{roomId}` — `{ name, createdAt, createdBy, lastMessage: { text?, imageURL?, uid, email, createdAt } }`
- `rooms/{roomId}/messages/{msgId}` — `{ text?, imageURL?, uid, email, createdAt, reactions?: Record<emoji, Record<uid, true>> }`
- `users/{uid}` — `{ online, lastSeen, email, photoURL, uid }`
- `users/{uid}/roomActivity/{roomId}` — `{ lastSeen: Timestamp }`
- `users/{uid}/fcmTokens/{tokenId}` — `{ token, createdAt, userAgent }`

## Reactions pattern

Reactions stored as nested map: `reactions.${emoji}.${uid} = true | deleteField()`.
Use `updateDoc(msgRef, { [\`reactions.${emoji}.${uid}\`]: true })` to add,
`deleteField()` to remove. This is atomic and avoids array union limits.

**Why:** Firestore `arrayUnion` doesn't support nested paths. The map approach allows
atomic per-user toggles without read-modify-write cycles.

## Unread badge logic

`lastMessage.createdAt > userActivity[roomId].lastSeen` → show badge.
Active room is always treated as read (badge suppressed in UI, lastSeen stamped on open).
Sender's roomActivity also stamped immediately on send to prevent self-badge.

## lastMessage denormalization

Room doc carries `lastMessage` field (updated via `updateDoc` after each message send).
This avoids subscribing to every room's messages collection just to show sidebar previews.
