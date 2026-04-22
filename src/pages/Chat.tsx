import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { EmptyChat } from "@/components/chat/EmptyChat";

const Chat = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activePeerUsername, setActivePeerUsername] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">Loading...</p></div>;
  if (!user) return null;

  return (
    <div className="flex h-screen bg-background">
      <ConversationSidebar
        activeConversationId={activeConversationId}
        onSelectConversation={(id, peerUsername) => {
          setActiveConversationId(id);
          setActivePeerUsername(peerUsername);
        }}
      />
      <div className="flex-1 flex flex-col">
        {activeConversationId ? (
          <ChatWindow conversationId={activeConversationId} peerUsername={activePeerUsername} />
        ) : (
          <EmptyChat />
        )}
      </div>
    </div>
  );
};

export default Chat;
