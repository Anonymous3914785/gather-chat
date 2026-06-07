import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { signOut } from "firebase/auth";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogOut, Send, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  id: string;
  text: string;
  uid: string;
  email: string;
  createdAt: any;
}

export default function Chat() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      // Reverse to show oldest at top, newest at bottom
      setMessages(msgs.reverse());
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const text = newMessage;
    setNewMessage("");

    await addDoc(collection(db, "messages"), {
      text,
      uid: user.uid,
      email: user.email,
      createdAt: serverTimestamp()
    });
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-4xl mx-auto shadow-2xl border-x border-border/40">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b flex items-center justify-between p-4 px-6 h-16">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground leading-tight">Gather</h1>
            <p className="text-xs text-muted-foreground leading-tight">Team Room</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 px-6 space-y-6 flex flex-col bg-card/30">
        {messages.map((msg, idx) => {
          const isMe = msg.uid === user.uid;
          const showHeader = idx === 0 || messages[idx - 1].uid !== msg.uid;
          
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] ${isMe ? 'ml-auto' : 'mr-auto'}`}>
              {!isMe && showHeader && (
                <div className="flex items-center gap-2 mb-1 pl-1">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                      {msg.email.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-muted-foreground">{msg.email.split('@')[0]}</span>
                </div>
              )}
              <div 
                className={`
                  px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm
                  ${isMe 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-card border border-border/50 text-foreground rounded-tl-sm'
                  }
                `}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} className="h-px" />
      </div>

      {/* Input Area */}
      <div className="p-4 px-6 bg-background border-t">
        <form onSubmit={handleSendMessage} className="flex gap-2 relative">
          <Input 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Message the team..."
            className="flex-1 rounded-full pl-6 pr-12 py-6 bg-card border-border/50 shadow-sm focus-visible:ring-primary/20"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!newMessage.trim()}
            className="absolute right-1.5 top-1.5 rounded-full w-9 h-9 transition-transform active:scale-95"
          >
            <Send className="w-4 h-4 ml-0.5" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
