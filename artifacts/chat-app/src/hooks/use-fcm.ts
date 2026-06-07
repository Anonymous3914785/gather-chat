import { useState, useEffect } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Registers the browser with Firebase Cloud Messaging.
 * Stores the token in Firestore so a server-side trigger (Cloud Function
 * or the API server with Admin SDK) can deliver push notifications.
 *
 * Requires VITE_FIREBASE_VAPID_KEY to be set.
 * Set it in Firebase console → Project settings → Cloud Messaging → Web Push certificates.
 */
export function useFcm(uid: string | undefined) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  const requestPermission = async () => {
    if (!uid || typeof Notification === "undefined") return;
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("VITE_FIREBASE_VAPID_KEY not set — push notifications disabled");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      const { getMessaging, getToken } = await import("firebase/messaging");
      const { app } = await import("@/lib/firebase");
      const messaging = getMessaging(app);
      const token = await getToken(messaging, { vapidKey });
      if (token && uid) {
        await setDoc(
          doc(db, "users", uid, "fcmTokens", token.substring(0, 20)),
          { token, createdAt: serverTimestamp(), userAgent: navigator.userAgent },
          { merge: true },
        );
      }
    } catch (err) {
      console.warn("FCM registration failed:", err);
    }
  };

  useEffect(() => {
    if (permission === "granted" && uid) requestPermission();
  }, [uid]);

  return { permission, requestPermission };
}
