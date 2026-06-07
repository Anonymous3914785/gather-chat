import { useEffect } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "firebase/auth";

export function usePresence(user: User | null) {
  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "users", user.uid);

    const setOnline = () =>
      setDoc(ref, { online: true, lastSeen: serverTimestamp(), email: user.email, uid: user.uid }, { merge: true });

    const setOffline = () =>
      setDoc(ref, { online: false, lastSeen: serverTimestamp() }, { merge: true });

    setOnline();

    window.addEventListener("focus", setOnline);
    window.addEventListener("blur", setOffline);
    window.addEventListener("beforeunload", setOffline);

    return () => {
      setOffline();
      window.removeEventListener("focus", setOnline);
      window.removeEventListener("blur", setOffline);
      window.removeEventListener("beforeunload", setOffline);
    };
  }, [user]);
}
