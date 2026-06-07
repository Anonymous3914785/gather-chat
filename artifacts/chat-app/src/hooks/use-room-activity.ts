import { useState, useEffect } from "react";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface RoomActivity {
  lastSeen: Timestamp | null;
}

/** Subscribes to the current user's lastSeen timestamps for every room. */
export function useRoomActivity(uid: string | undefined) {
  const [activity, setActivity] = useState<Record<string, RoomActivity>>({});

  useEffect(() => {
    if (!uid) return;
    const col = collection(db, "users", uid, "roomActivity");
    const unsub = onSnapshot(col, (snap) => {
      const map: Record<string, RoomActivity> = {};
      snap.docs.forEach((d) => {
        map[d.id] = { lastSeen: d.data().lastSeen ?? null };
      });
      setActivity(map);
    });
    return () => unsub();
  }, [uid]);

  return activity;
}
