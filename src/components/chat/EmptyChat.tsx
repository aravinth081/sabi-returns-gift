import { MessageCircle } from "lucide-react";

export const EmptyChat = () => (
  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
    <MessageCircle className="h-16 w-16 mb-4 opacity-30" />
    <h2 className="text-xl font-semibold mb-1">Select a conversation</h2>
    <p className="text-sm">Search for a user in the sidebar to start chatting</p>
  </div>
);
