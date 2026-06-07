import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string | null;
  online: boolean;
  lastSeen?: any;
}

export function useUserProfiles() {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const map: Record<string, UserProfile> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data() as UserProfile;
        map[d.id] = { ...data, uid: d.id };
      });
      setProfiles(map);
    });
    return () => unsubscribe();
  }, []);

  return profiles;
}
