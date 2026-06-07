import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
  doc,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LogOut, Send, MessageCircle, Plus, Hash } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  id: string;
  text: string;
  uid: string;
  email: string;
  createdAt: any;
}

interface Room {
  id: string;
  name: string;
  createdAt: any;
}

function Sidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  onSignOut,
  userEmail,
}: {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
  onCreateRoom: () => void;
  onSignOut: () => void;
  userEmail: string;
}) {
  return (
    <aside className="w-64 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
        <div className="w-7 h-7 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
          <MessageCircle className="w-4 h-4" />
        </div>
        <span className="font-bold text-sidebar-foreground tracking-tight text-lg">Gather</span>
      </div>

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
              onClick={() => onSelectRoom(room.id)}
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

      <div className="border-t border-sidebar-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="w-7 h-7 shrink-0">
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {userEmail.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-sidebar-foreground/70 truncate">{userEmail.split("@")[0]}</span>
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
  );
}

function MessageArea({ roomId, user }: { roomId: string; user: any }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs.reverse());
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    const text = newMessage;
    setNewMessage("");
    await addDoc(collection(db, "rooms", roomId, "messages"), {
      text,
      uid: user.uid,
      email: user.email,
      createdAt: serverTimestamp(),
    });
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 px-6 flex flex-col space-y-4 bg-card/20">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground italic">No messages yet — say hello!</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMe = msg.uid === user.uid;
          const showHeader = idx === 0 || messages[idx - 1].uid !== msg.uid;
          return (
            <div
              key={msg.id}
              data-testid={`message-${msg.id}`}
              className={`flex flex-col ${isMe ? "items-end ml-auto" : "items-start mr-auto"} max-w-[80%]`}
            >
              {!isMe && showHeader && (
                <div className="flex items-center gap-2 mb-1 pl-1">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                      {msg.email.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-muted-foreground">
                    {msg.email.split("@")[0]}
                  </span>
                </div>
              )}
              <div
                className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                  isMe
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border/50 text-foreground rounded-tl-sm"
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} className="h-px" />
      </div>

      <div className="p-4 px-6 bg-background border-t">
        <form onSubmit={handleSend} className="flex gap-2 relative">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Message the room..."
            data-testid="input-message"
            className="flex-1 rounded-full pl-6 pr-12 py-6 bg-card border-border/50 shadow-sm focus-visible:ring-primary/20"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim()}
            data-testid="button-send"
            className="absolute right-1.5 top-1.5 rounded-full w-9 h-9 transition-transform active:scale-95"
          >
            <Send className="w-4 h-4 ml-0.5" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </>
  );
}

export default function Chat() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/chat/:roomId");
  const activeRoomId = params?.roomId ?? null;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) setLocation("/");
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "rooms"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const r = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Room[];
      setRooms(r);
      if (!activeRoomId && r.length > 0) {
        setLocation(`/chat/${r[0].id}`);
      }
    });
    return () => unsubscribe();
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

  if (loading || !user) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={(id) => setLocation(`/chat/${id}`)}
        onCreateRoom={() => setShowCreateDialog(true)}
        onSignOut={() => signOut(auth)}
        userEmail={user.email ?? ""}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {activeRoomId ? (
          <>
            <header className="h-16 border-b flex items-center px-6 gap-2 shrink-0 bg-background">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">
                {rooms.find((r) => r.id === activeRoomId)?.name ?? "Room"}
              </h2>
            </header>
            <MessageArea roomId={activeRoomId} user={user} />
          </>
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
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
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
