import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Moon, Sun, Search, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConversationItem {
  conversationId: string;
  peerId: string;
  peerUsername: string;
  lastMessage?: string;
  lastMessageTime?: string;
}

interface Props {
  activeConversationId: string | null;
  onSelectConversation: (id: string, peerUsername: string) => void;
}

export const ConversationSidebar = ({ activeConversationId, onSelectConversation }: Props) => {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; username: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const loadConversations = async () => {
    if (!user) return;

    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .eq("user_id", user.id);

    if (!participants?.length) return;

    const convIds = participants.map((p) => p.conversation_id);

    // Get peer participants
    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds)
      .neq("user_id", user.id);

    if (!allParticipants?.length) return;

    const peerIds = [...new Set(allParticipants.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", peerIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p.username]) ?? []);

    // Get last messages
    const { data: lastMessages } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });

    const lastMessageMap = new Map<string, { content: string; created_at: string }>();
    lastMessages?.forEach((m) => {
      if (!lastMessageMap.has(m.conversation_id)) {
        lastMessageMap.set(m.conversation_id, { content: m.content, created_at: m.created_at });
      }
    });

    const items: ConversationItem[] = allParticipants.map((p) => ({
      conversationId: p.conversation_id,
      peerId: p.user_id,
      peerUsername: profileMap.get(p.user_id) ?? "Unknown",
      lastMessage: lastMessageMap.get(p.conversation_id)?.content,
      lastMessageTime: lastMessageMap.get(p.conversation_id)?.created_at,
    }));

    // Dedupe by conversationId
    const unique = Array.from(new Map(items.map((i) => [i.conversationId, i])).values());
    unique.sort((a, b) => (b.lastMessageTime ?? "").localeCompare(a.lastMessageTime ?? ""));
    setConversations(unique);
  };

  useEffect(() => {
    loadConversations();
  }, [user]);

  // Realtime subscription for new messages to refresh sidebar
  useEffect(() => {
    const channel = supabase
      .channel("sidebar-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", `%${searchQuery}%`)
      .neq("id", user?.id ?? "")
      .limit(10);
    setSearchResults(data ?? []);
    setIsSearching(false);
  };

  useEffect(() => {
    const timeout = setTimeout(handleSearch, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const startConversation = async (peerId: string, peerUsername: string) => {
    // Check if conversation already exists
    const existing = conversations.find((c) => c.peerId === peerId);
    if (existing) {
      onSelectConversation(existing.conversationId, peerUsername);
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    // Create new conversation
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({})
      .select()
      .single();

    if (convError || !conv) {
      toast({ title: "Error", description: "Could not create conversation", variant: "destructive" });
      return;
    }

    // Add self as participant
    await supabase.from("conversation_participants").insert({ conversation_id: conv.id, user_id: user!.id });
    // Add peer
    await supabase.from("conversation_participants").insert({ conversation_id: conv.id, user_id: peerId });

    setSearchQuery("");
    setSearchResults([]);
    await loadConversations();
    onSelectConversation(conv.id, peerUsername);
  };

  return (
    <div className="w-80 border-r border-border flex flex-col bg-card h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Chats</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Current user */}
      <div className="px-4 py-2 border-b border-border">
        <p className="text-xs text-muted-foreground">Signed in as</p>
        <p className="text-sm font-medium text-foreground">{profile?.username ?? "..."}</p>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="px-3 pb-2">
          <p className="text-xs text-muted-foreground mb-1">Users found</p>
          {searchResults.map((u) => (
            <button
              key={u.id}
              onClick={() => startConversation(u.id, u.username)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {u.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1">
                <Plus className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm text-foreground">{u.username}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Conversations */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          {conversations.map((c) => (
            <button
              key={c.conversationId}
              onClick={() => onSelectConversation(c.conversationId, c.peerUsername)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left mb-0.5 ${
                activeConversationId === c.conversationId ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-secondary text-secondary-foreground">
                  {c.peerUsername.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.peerUsername}</p>
                {c.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                )}
              </div>
              {c.lastMessageTime && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(c.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </button>
          ))}
          {conversations.length === 0 && !searchQuery && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Search for users to start chatting
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
