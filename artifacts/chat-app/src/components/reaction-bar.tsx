import { deleteField, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const EMOJI_SET = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface ReactionBarProps {
  roomId: string;
  msgId: string;
  uid: string;
  reactions: Record<string, Record<string, boolean>> | undefined;
  isMe: boolean;
  visible: boolean;
}

export function ReactionBar({ roomId, msgId, uid, reactions, isMe, visible }: ReactionBarProps) {
  const toggle = async (emoji: string) => {
    const msgRef = doc(db, "rooms", roomId, "messages", msgId);
    const hasReacted = reactions?.[emoji]?.[uid] === true;
    if (hasReacted) {
      await updateDoc(msgRef, { [`reactions.${emoji}.${uid}`]: deleteField() });
    } else {
      await updateDoc(msgRef, { [`reactions.${emoji}.${uid}`]: true });
    }
  };

  if (!visible) return null;

  return (
    <div
      className={`absolute ${isMe ? "right-0" : "left-0"} -top-10 z-10 flex items-center gap-0.5 bg-popover border border-border rounded-full px-2 py-1 shadow-lg animate-in fade-in zoom-in-95 duration-100`}
    >
      {EMOJI_SET.map((emoji) => (
        <button
          key={emoji}
          onClick={(e) => { e.stopPropagation(); toggle(emoji); }}
          className={`text-base leading-none px-1 py-0.5 rounded-full transition-transform hover:scale-125 hover:bg-accent ${
            reactions?.[emoji]?.[uid] ? "bg-primary/10" : ""
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

interface ReactionChipsProps {
  roomId: string;
  msgId: string;
  uid: string;
  reactions: Record<string, Record<string, boolean>> | undefined;
}

export function ReactionChips({ roomId, msgId, uid, reactions }: ReactionChipsProps) {
  if (!reactions) return null;

  const entries = Object.entries(reactions)
    .map(([emoji, uids]) => ({ emoji, count: Object.keys(uids).length, reacted: uids[uid] === true }))
    .filter((e) => e.count > 0);

  if (entries.length === 0) return null;

  const toggle = async (emoji: string) => {
    const msgRef = doc(db, "rooms", roomId, "messages", msgId);
    const hasReacted = reactions?.[emoji]?.[uid] === true;
    if (hasReacted) {
      await updateDoc(msgRef, { [`reactions.${emoji}.${uid}`]: deleteField() });
    } else {
      await updateDoc(msgRef, { [`reactions.${emoji}.${uid}`]: true });
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {entries.map(({ emoji, count, reacted }) => (
        <button
          key={emoji}
          onClick={(e) => { e.stopPropagation(); toggle(emoji); }}
          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
            reacted
              ? "bg-primary/15 border-primary/40 text-primary font-medium"
              : "bg-background border-border/60 text-muted-foreground hover:border-primary/30 hover:bg-primary/5"
          }`}
        >
          <span>{emoji}</span>
          <span>{count}</span>
        </button>
      ))}
    </div>
  );
}
