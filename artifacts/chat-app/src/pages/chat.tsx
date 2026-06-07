import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { signOut } from "firebase/auth";
import {
  collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, limit, doc, setDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { usePresence } from "@/hooks/use-presence";
import { useUserProfiles } from "@/hooks/use-user-profiles";
import type { UserProfile } from "@/hooks/use-user-profiles";
import { format, isToday, isYesterday } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LogOut, Send, MessageCircle, Plus, Hash, ImageIcon, Menu, X, Camera } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  text?: string;
  imageURL?: string;
  uid: string;
  email: string;
  createdAt: any;
}

interface Room {
  id: string;
  name: string;
  createdAt: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(ts: any): string {
  if (!ts?.toDate) return "";
  const date = ts.toDate() as Date;
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
  return format(date, "MMM d, h:mm a");
}

function formatDateDivider(ts: any): string {
  if (!ts?.toDate) return "";
  const date = ts.toDate() as Date;
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function isSameDay(a: any, b: any): boolean {
  if (!a?.toDate || !b?.toDate) return true;
  const da = a.toDate() as Date;
  const db2 = b.toDate() as Date;
  return da.toDateString() === db2.toDateString();
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

  const handleClick = () => {
    if (clickable && onUpload) fileRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) onUpload(file);
    e.target.value = "";
  };

  return (
    <div className="relative shrink-0">
      <div
        onClick={handleClick}
        className={`${clickable ? "cursor-pointer group" : ""} relative`}
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
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-sidebar ${
            profile?.online ? "bg-emerald-400" : "bg-muted-foreground/40"
          }`}
        />
      )}
      {clickable && onUpload && (
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  rooms, activeRoomId, profiles, currentUser, onSelectRoom, onCreateRoom, onSignOut,
  onAvatarUpload, open, onClose,
}: {
  rooms: Room[]; activeRoomId: string | null;
  profiles: Record<string, UserProfile>;
  currentUser: any;
  onSelectRoom: (id: string) => void;
  onCreateRoom: () => void;
  onSignOut: () => void;
  onAvatarUpload: (file: File) => void;
  open: boolean;
  onClose: () => void;
}) {
  const myProfile = profiles[currentUser?.uid ?? ""];
  const onlineCount = Object.values(profiles).filter((p) => p.online).length;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed md:relative z-30 md:z-auto inset-y-0 left-0
          w-64 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border h-full
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="font-bold text-sidebar-foreground tracking-tight text-lg">Gather</span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Online count */}
        {onlineCount > 0 && (
          <div className="px-5 py-2 text-xs text-sidebar-foreground/50 flex items-center gap-1.5 border-b border-sidebar-border/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
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

          <div className="space-y-0.5">
            {rooms.map((room) => (
              <button
                key={room.id}
                data-testid={`button-room-${room.id}`}
                onClick={() => { onSelectRoom(room.id); onClose(); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  activeRoomId === room.id
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Hash className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{room.name}</span>
              </button>
            ))}
            {rooms.length === 0 && (
              <p className="px-3 py-2 text-xs text-sidebar-foreground/40 italic">
                No rooms yet — create one!
              </p>
            )}
          </div>
        </div>

        {/* User footer */}
        <div className="border-t border-sidebar-border px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <UserAvatar
                    profile={myProfile}
                    email={currentUser?.email ?? ""}
                    uid={currentUser?.uid ?? ""}
                    size="sm"
                    showOnline
                    clickable
                    onUpload={onAvatarUpload}
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
            onClick={onSignOut}
            data-testid="button-sign-out"
            title="Sign out"
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
  roomId, user, profiles,
}: {
  roomId: string; user: any; profiles: Record<string, UserProfile>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages([]);
    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("createdAt", "desc"),
      limit(80),
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs.reverse());
    });
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    const text = newMessage;
    setNewMessage("");
    await addDoc(collection(db, "rooms", roomId, "messages"), {
      text, uid: user.uid, email: user.email, createdAt: serverTimestamp(),
    });
  };

  const sendImage = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `message-images/${roomId}/${crypto.randomUUID()}.${ext}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await addDoc(collection(db, "rooms", roomId, "messages"), {
        imageURL: url, uid: user.uid, email: user.email, createdAt: serverTimestamp(),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 px-4 md:px-6 flex flex-col space-y-1 bg-card/20">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic">No messages yet — say hello!</p>
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
                className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"} ${
                  isFirstInGroup ? "mt-3" : "mt-0.5"
                }`}
                data-testid={`message-${msg.id}`}
              >
                {/* Avatar — shown for others on the last msg in a group */}
                {!isMe ? (
                  <div className="w-9 shrink-0 flex items-end">
                    {isLastInGroup ? (
                      <UserAvatar
                        profile={senderProfile}
                        email={msg.email}
                        uid={msg.uid}
                        size="md"
                      />
                    ) : (
                      <div className="w-9" />
                    )}
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

                  {msg.imageURL ? (
                    <a href={msg.imageURL} target="_blank" rel="noopener noreferrer">
                      <img
                        src={msg.imageURL}
                        alt="Shared image"
                        className="max-w-[240px] md:max-w-xs rounded-2xl shadow-sm border border-border/30 object-cover"
                        style={{ maxHeight: 300 }}
                      />
                    </a>
                  ) : (
                    <div
                      className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                          : "bg-card border border-border/50 text-foreground rounded-2xl rounded-tl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}

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
          <p className="text-xs text-muted-foreground mb-2 px-1">Uploading image…</p>
        )}
        <form onSubmit={sendText} className="flex gap-2 items-center">
          <button
            type="button"
            data-testid="button-image-upload"
            onClick={() => imageInputRef.current?.click()}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) sendImage(file);
              e.target.value = "";
            }}
          />
          <div className="relative flex-1">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message the room…"
              data-testid="input-message"
              className="rounded-full pl-5 pr-12 py-5 bg-card border-border/50 focus-visible:ring-primary/20"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim() || uploading}
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const profiles = useUserProfiles();
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
      if (!activeRoomId && r.length > 0) setLocation(`/chat/${r[0].id}`);
    });
    return () => unsub();
  }, [user, activeRoomId, setLocation]);

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
    const path = `avatars/${user.uid}.${ext}`;
    const sRef = storageRef(storage, path);
    await uploadBytes(sRef, file);
    const url = await getDownloadURL(sRef);
    await setDoc(doc(db, "users", user.uid), { photoURL: url }, { merge: true });
  };

  if (loading || !user) return null;

  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoomId}
        profiles={profiles}
        currentUser={user}
        onSelectRoom={(id) => setLocation(`/chat/${id}`)}
        onCreateRoom={() => setShowCreateDialog(true)}
        onSignOut={() => signOut(auth)}
        onAvatarUpload={handleAvatarUpload}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 border-b flex items-center px-4 gap-3 shrink-0 bg-background">
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          {activeRoom ? (
            <>
              <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
              <h2 className="font-semibold text-foreground truncate">{activeRoom.name}</h2>
              <div className="ml-auto flex items-center gap-1.5">
                {Object.values(profiles).filter((p) => p.online).slice(0, 5).map((p) => (
                  <UserAvatar
                    key={p.uid}
                    profile={p}
                    email={p.email}
                    uid={p.uid}
                    size="sm"
                  />
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
          <MessageArea roomId={activeRoomId} user={user} profiles={profiles} />
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-center px-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Hash className="w-6 h-6 text-primary" />
            </div>
            <p className="font-semibold text-foreground">No room selected</p>
            <p className="text-sm text-muted-foreground">
              Pick a room from the sidebar or create a new one.
            </p>
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
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            data-testid="input-room-name"
            onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateRoom}
              disabled={!newRoomName.trim() || creating}
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
