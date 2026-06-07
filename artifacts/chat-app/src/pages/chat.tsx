import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { signOut } from "firebase/auth";
import {
  collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, limit, doc, setDoc, updateDoc, Timestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { usePresence } from "@/hooks/use-presence";
import { useUserProfiles } from "@/hooks/use-user-profiles";
import { useRoomActivity } from "@/hooks/use-room-activity";
import { useFcm } from "@/hooks/use-fcm";
import { ReactionBar, ReactionChips } from "@/components/reaction-bar";
import type { UserProfile } from "@/hooks/use-user-profiles";
import { format, isToday, isYesterday } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LogOut, Send, MessageCircle, Plus, Hash, ImageIcon, Menu, X, Camera, Bell, BellOff } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LastMessage {
  text?: string;
  imageURL?: string;
  uid: string;
  email: string;
  createdAt: Timestamp | null;
}

interface Room {
  id: string;
  name: string;
  createdAt: Timestamp | null;
  lastMessage?: LastMessage;
}

interface Message {
  id: string;
  text?: string;
  imageURL?: string;
  uid: string;
  email: string;
  createdAt: Timestamp | null;
  reactions?: Record<string, Record<string, boolean>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(ts: Timestamp | null): string {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

function formatShortTime(ts: Timestamp | null | undefined): string {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function formatDateDivider(ts: Timestamp | null): string {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

function isSameDay(a: Timestamp | null | undefined, b: Timestamp | null | undefined): boolean {
  if (!a?.toDate || !b?.toDate) return true;
  return a.toDate().toDateString() === b.toDate().toDateString();
}

function isUnread(lastMessage: LastMessage | undefined, lastSeen: Timestamp | null): boolean {
  if (!lastMessage?.createdAt) return false;
  if (!lastSeen) return true;
  return lastMessage.createdAt.toMillis() > lastSeen.toMillis();
}

function avatarInitials(profile: UserProfile | undefined, email: string): string {
  if (profile?.displayName) return profile.displayName.substring(0, 2).toUpperCase();
  return email.substring(0, 2).toUpperCase();
}

function avatarColor(uid: string): string {
  const colors = [
    "bg-orange-400", "bg-rose-400", "bg-violet-400",
    "bg-blue-400", "bg-emerald-400", "bg-amber-400", "bg-pink-400", "bg-teal-400",
  ];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function lastMessagePreview(msg: LastMessage | undefined, myUid: string): string {
  if (!msg) return "No messages yet";
  const who = msg.uid === myUid ? "You" : msg.email.split("@")[0];
  if (msg.imageURL) return `${who}: 📷 Image`;
  return `${who}: ${msg.text ?? ""}`;
}

// ─── UserAvatar ───────────────────────────────────────────────────────────────

function UserAvatar({
  profile, email, uid, size = "md", showOnline = false, clickable = false, onUpload,
}: {
  profile?: UserProfile; email: string; uid: string;
  size?: "sm" | "md"; showOnline?: boolean; clickable?: boolean;
  onUpload?: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const sizeClass = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-[11px]";

  return (
    <div className="relative shrink-0">
      <div
        onClick={() => clickable && fileRef.current?.click()}
        className={clickable ? "cursor-pointer group relative" : ""}
      >
        <Avatar className={sizeClass}>
          {profile?.photoURL && <AvatarImage src={profile.photoURL} alt={email} />}
          <AvatarFallback className={`${avatarColor(uid)} text-white font-semibold`}>
            {avatarInitials(profile, email)}
          </AvatarFallback>
        </Avatar>
        {clickable && (
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      {showOnline && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-sidebar ${
          profile?.online ? "bg-emerald-400" : "bg-muted-foreground/30"
        }`} />
      )}
      {clickable && onUpload && (
        <input
          ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
        />
      )}
    </div>
  );
}

// ─── Sidebar Skeletons ────────────────────────────────────────────────────────

function SidebarSkeletons() {
  return (
    <div className="space-y-1 px-2 pt-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg">
          <Skeleton className="w-3.5 h-3.5 rounded-sm shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-2.5 w-10 rounded" />
            </div>
            <Skeleton className="h-2.5 w-36 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Message Skeletons ────────────────────────────────────────────────────────

function MessageSkeletons() {
  return (
    <div className="flex-1 flex flex-col gap-4 p-4 md:p-6">
      {[
        { me: false, w: "w-48" }, { me: false, w: "w-64" },
        { me: true, w: "w-40" }, { me: true, w: "w-56" },
        { me: false, w: "w-52" }, { me: true, w: "w-32" },
      ].map((item, i) => (
        <div key={i} className={`flex gap-2.5 ${item.me ? "flex-row-reverse" : "flex-row"}`}>
          {!item.me && <Skeleton className="w-9 h-9 rounded-full shrink-0 self-end" />}
          {item.me && <div className="w-9 shrink-0" />}
          <div className={`flex flex-col gap-1 max-w-[60%] ${item.me ? "items-end" : "items-start"}`}>
            {!item.me && <Skeleton className="h-2.5 w-16 rounded" />}
            <Skeleton className={`h-10 ${item.w} rounded-2xl`} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  rooms, activeRoomId, profiles, currentUser, roomActivity, loadingRooms,
  onSelectRoom, onCreateRoom, onSignOut, onAvatarUpload, open, onClose,
  notifPermission, onEnableNotifications,
}: {
  rooms: Room[]; activeRoomId: string | null; loadingRooms: boolean;
  profiles: Record<string, UserProfile>; currentUser: any;
  roomActivity: Record<string, { lastSeen: Timestamp | null }>;
  onSelectRoom: (id: string) => void; onCreateRoom: () => void;
  onSignOut: () => void; onAvatarUpload: (file: File) => void;
  open: boolean; onClose: () => void;
  notifPermission: NotificationPermission; onEnableNotifications: () => void;
}) {
  const myProfile = profiles[currentUser?.uid ?? ""];
  const onlineCount = Object.values(profiles).filter((p) => p.online).length;

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed md:relative z-30 md:z-auto inset-y-0 left-0
        w-72 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border h-full
        transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="font-bold text-sidebar-foreground tracking-tight text-lg">Gather</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Notification bell */}
            {notifPermission !== "granted" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onEnableNotifications}
                    className="w-7 h-7 flex items-center justify-center rounded text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Enable push notifications</TooltipContent>
              </Tooltip>
            )}
            {notifPermission === "granted" && (
              <span title="Notifications enabled" className="w-7 h-7 flex items-center justify-center text-emerald-400">
                <Bell className="w-3.5 h-3.5" />
              </span>
            )}
            <button onClick={onClose} className="md:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Online pill */}
        {onlineCount > 0 && (
          <div className="px-5 py-2 text-xs text-sidebar-foreground/50 flex items-center gap-1.5 border-b border-sidebar-border/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            {onlineCount} online now
          </div>
        )}

        {/* Room list */}
        <div className="flex-1 overflow-y-auto py-3 px-2">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/50">
              Rooms
            </span>
            <button
              onClick={onCreateRoom}
              data-testid="button-create-room"
              className="w-5 h-5 flex items-center justify-center rounded text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingRooms ? (
            <SidebarSkeletons />
          ) : (
            <div className="space-y-0.5">
              {rooms.map((room) => {
                const isActive = activeRoomId === room.id;
                const lastSeen = roomActivity[room.id]?.lastSeen ?? null;
                const hasUnread = !isActive && isUnread(room.lastMessage, lastSeen);

                return (
                  <button
                    key={room.id}
                    data-testid={`button-room-${room.id}`}
                    onClick={() => { onSelectRoom(room.id); onClose(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left group ${
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                  >
                    <Hash className={`w-3.5 h-3.5 shrink-0 ${hasUnread ? "text-primary" : ""}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`truncate ${hasUnread ? "font-semibold text-sidebar-foreground" : "font-medium"}`}>
                          {room.name}
                        </span>
                        {room.lastMessage?.createdAt && (
                          <span className={`text-[10px] shrink-0 ${
                            isActive ? "text-sidebar-primary-foreground/60"
                            : hasUnread ? "text-primary font-medium"
                            : "text-sidebar-foreground/40"
                          }`}>
                            {formatShortTime(room.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      {room.lastMessage && (
                        <p className={`text-[11px] truncate mt-0.5 ${
                          isActive ? "text-sidebar-primary-foreground/60"
                          : hasUnread ? "text-sidebar-foreground/80"
                          : "text-sidebar-foreground/40"
                        }`}>
                          {lastMessagePreview(room.lastMessage, currentUser?.uid ?? "")}
                        </p>
                      )}
                    </div>
                    {hasUnread && (
                      <span
                        data-testid={`badge-unread-${room.id}`}
                        className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center"
                      >
                        •
                      </span>
                    )}
                  </button>
                );
              })}

              {rooms.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-sidebar-foreground/40 italic">No rooms yet</p>
                  <button
                    onClick={onCreateRoom}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Create your first room →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User footer */}
        <div className="border-t border-sidebar-border px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <UserAvatar
                    profile={myProfile} email={currentUser?.email ?? ""}
                    uid={currentUser?.uid ?? ""} size="sm"
                    showOnline clickable onUpload={onAvatarUpload}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">Click to change photo</TooltipContent>
            </Tooltip>
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {myProfile?.displayName || currentUser?.email?.split("@")[0]}
              </p>
              <p className="text-[10px] text-emerald-400 leading-tight">Online</p>
            </div>
          </div>
          <button
            onClick={onSignOut} data-testid="button-sign-out" title="Sign out"
            className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Message Area ─────────────────────────────────────────────────────────────

function MessageArea({
  roomId, user, profiles, onMessageSent,
}: {
  roomId: string; user: any;
  profiles: Record<string, UserProfile>;
  onMessageSent: (payload: Omit<LastMessage, "createdAt">) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages([]);
    setLoadingMessages(true);
    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("createdAt", "desc"),
      limit(80),
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs.reverse());
      setLoadingMessages(false);
    });
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Re-focus input after upload
  useEffect(() => {
    if (!uploading) inputRef.current?.focus();
  }, [uploading]);

  const sendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || !user) return;
    setNewMessage("");
    await addDoc(collection(db, "rooms", roomId, "messages"), {
      text, uid: user.uid, email: user.email, createdAt: serverTimestamp(),
    });
    onMessageSent({ text, uid: user.uid, email: user.email });
  };

  const sendImage = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `message-images/${roomId}/${crypto.randomUUID()}.${ext}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const imageURL = await getDownloadURL(sRef);
      await addDoc(collection(db, "rooms", roomId, "messages"), {
        imageURL, uid: user.uid, email: user.email, createdAt: serverTimestamp(),
      });
      onMessageSent({ imageURL, uid: user.uid, email: user.email });
    } finally {
      setUploading(false);
    }
  };

  if (loadingMessages) return <MessageSkeletons />;

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 px-4 md:px-6 flex flex-col space-y-1 bg-card/20">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center flex-col gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">No messages yet — say hello!</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.uid === user.uid;
          const prev = messages[idx - 1];
          const next = messages[idx + 1];
          const showDateDivider = idx === 0 || !isSameDay(prev?.createdAt, msg.createdAt);
          const isFirstInGroup = showDateDivider || !prev || prev.uid !== msg.uid;
          const isLastInGroup = !next || next.uid !== msg.uid || !isSameDay(msg.createdAt, next?.createdAt);
          const senderProfile = profiles[msg.uid];
          const isHovered = hoveredMsgId === msg.id;

          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-xs text-muted-foreground font-medium shrink-0">
                    {formatDateDivider(msg.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
              )}

              <div
                className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"} ${isFirstInGroup ? "mt-3" : "mt-0.5"}`}
                data-testid={`message-${msg.id}`}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
              >
                {!isMe ? (
                  <div className="w-9 shrink-0 flex items-end">
                    {isLastInGroup
                      ? <UserAvatar profile={senderProfile} email={msg.email} uid={msg.uid} size="md" />
                      : <div className="w-9" />}
                  </div>
                ) : (
                  <div className="w-9 shrink-0" />
                )}

                <div className={`flex flex-col max-w-[70%] md:max-w-[60%] ${isMe ? "items-end" : "items-start"}`}>
                  {!isMe && isFirstInGroup && (
                    <span className="text-xs font-medium text-muted-foreground mb-1 ml-1">
                      {senderProfile?.displayName || msg.email.split("@")[0]}
                    </span>
                  )}

                  {/* Bubble + reaction picker */}
                  <div className="relative">
                    <ReactionBar
                      roomId={roomId} msgId={msg.id} uid={user.uid}
                      reactions={msg.reactions} isMe={isMe} visible={isHovered}
                    />

                    {msg.imageURL ? (
                      <a href={msg.imageURL} target="_blank" rel="noopener noreferrer">
                        <img
                          src={msg.imageURL} alt="Shared image"
                          className="max-w-[240px] md:max-w-xs rounded-2xl shadow-sm border border-border/30 object-cover"
                          style={{ maxHeight: 300 }}
                        />
                      </a>
                    ) : (
                      <div className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                          : "bg-card border border-border/50 text-foreground rounded-2xl rounded-tl-sm"
                      }`}>
                        {msg.text}
                      </div>
                    )}
                  </div>

                  {/* Reaction chips */}
                  <ReactionChips
                    roomId={roomId} msgId={msg.id}
                    uid={user.uid} reactions={msg.reactions}
                  />

                  {isLastInGroup && (
                    <span className="text-[11px] text-muted-foreground/60 mt-1 mx-1">
                      {formatTimestamp(msg.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} className="h-px" />
      </div>

      {/* Input */}
      <div className="p-3 px-4 md:px-6 bg-background border-t shrink-0">
        {uploading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 px-1">
            <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" />
            Uploading image…
          </div>
        )}
        <form onSubmit={sendText} className="flex gap-2 items-center">
          <button
            type="button" data-testid="button-image-upload"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <input
            ref={imageInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = ""; }}
          />
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message the room…" data-testid="input-message"
              className="rounded-full pl-5 pr-12 py-5 bg-card border-border/50 focus-visible:ring-primary/20"
            />
            <Button
              type="submit" size="icon" disabled={!newMessage.trim() || uploading}
              data-testid="button-send"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full w-8 h-8 transition-transform active:scale-95"
            >
              <Send className="w-3.5 h-3.5 ml-0.5" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────

export default function Chat() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/chat/:roomId");
  const activeRoomId = params?.roomId ?? null;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const profiles = useUserProfiles();
  const roomActivity = useRoomActivity(user?.uid);
  const { permission: notifPermission, requestPermission } = useFcm(user?.uid);
  usePresence(user);

  useEffect(() => {
    if (!loading && !user) setLocation("/");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "rooms"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const r = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Room[];
      setRooms(r);
      setLoadingRooms(false);
      if (!activeRoomId && r.length > 0) setLocation(`/chat/${r[0].id}`);
    });
    return () => unsub();
  }, [user, activeRoomId, setLocation]);

  // Mark room as read when opening it
  useEffect(() => {
    if (!activeRoomId || !user) return;
    setDoc(
      doc(db, "users", user.uid, "roomActivity", activeRoomId),
      { lastSeen: serverTimestamp() },
      { merge: true },
    );
  }, [activeRoomId, user]);

  const handleMessageSent = async (payload: Omit<LastMessage, "createdAt">) => {
    if (!activeRoomId) return;
    await updateDoc(doc(db, "rooms", activeRoomId), {
      lastMessage: { ...payload, createdAt: serverTimestamp() },
    });
    if (user) {
      setDoc(
        doc(db, "users", user.uid, "roomActivity", activeRoomId),
        { lastSeen: serverTimestamp() },
        { merge: true },
      );
    }
  };

  const handleCreateRoom = async () => {
    const name = newRoomName.trim();
    if (!name || !user) return;
    setCreating(true);
    const roomRef = doc(collection(db, "rooms"));
    await setDoc(roomRef, { name, createdAt: serverTimestamp(), createdBy: user.uid });
    setNewRoomName("");
    setShowCreateDialog(false);
    setCreating(false);
    setLocation(`/chat/${roomRef.id}`);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const sRef = storageRef(storage, `avatars/${user.uid}.${ext}`);
    await uploadBytes(sRef, file);
    const url = await getDownloadURL(sRef);
    await setDoc(doc(db, "users", user.uid), { photoURL: url }, { merge: true });
  };

  if (loading || !user) return (
    <div className="flex h-screen bg-background items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-primary/40 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoomId}
        profiles={profiles}
        currentUser={user}
        roomActivity={roomActivity}
        loadingRooms={loadingRooms}
        onSelectRoom={(id) => setLocation(`/chat/${id}`)}
        onCreateRoom={() => setShowCreateDialog(true)}
        onSignOut={() => signOut(auth)}
        onAvatarUpload={handleAvatarUpload}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        notifPermission={notifPermission}
        onEnableNotifications={requestPermission}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 border-b flex items-center px-4 gap-3 shrink-0 bg-background">
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(true)} data-testid="button-menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          {activeRoom ? (
            <>
              <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
              <h2 className="font-semibold text-foreground truncate">{activeRoom.name}</h2>
              <div className="ml-auto flex items-center gap-1.5">
                {Object.values(profiles).filter((p) => p.online).slice(0, 5).map((p) => (
                  <UserAvatar key={p.uid} profile={p} email={p.email} uid={p.uid} size="sm" />
                ))}
                {Object.values(profiles).filter((p) => p.online).length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    +{Object.values(profiles).filter((p) => p.online).length - 5}
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">Select a room</span>
          )}
        </header>

        {activeRoomId ? (
          <MessageArea
            roomId={activeRoomId} user={user} profiles={profiles}
            onMessageSent={handleMessageSent}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-center px-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Hash className="w-6 h-6 text-primary" />
            </div>
            <p className="font-semibold text-foreground">No room selected</p>
            <p className="text-sm text-muted-foreground">Pick a room from the sidebar or create a new one.</p>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create a room
            </Button>
          </div>
        )}
      </main>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a room</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. general, design, engineering"
            value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)}
            data-testid="input-room-name"
            onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateRoom} disabled={!newRoomName.trim() || creating}
              data-testid="button-confirm-create-room"
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
