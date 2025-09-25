import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, ChatMessage } from "@shared/schema";
import { Bot, User, Send, RotateCcw, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AiChatProps {
  selectedDatabase: Database | null;
  queryResults?: any;
  onQueryGenerated: (query: string) => void;
}

export default function AiChat({ selectedDatabase, queryResults, onQueryGenerated }: AiChatProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["/api/chat/messages", selectedDatabase?.id],
    enabled: !!selectedDatabase?.id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const response = await apiRequest("POST", "/api/ai/chat", {
        message: messageText,
        databaseId: selectedDatabase?.id,
        queryResults: queryResults?.results?.slice(0, 5) // Send first 5 rows for context
      });
      return response.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", selectedDatabase?.id] });
      setMessage("");
      setIsTyping(false);
      
      if (data.suggestedQuery) {
        toast({
          title: "SQL Query Suggested",
          description: "Click 'Run Query' to execute the suggested query",
        });
      }
    },
    onError: (error: any) => {
      setIsTyping(false);
      toast({
        title: "Failed to send message",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/chat/messages?databaseId=${selectedDatabase?.id || ''}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", selectedDatabase?.id] });
      toast({
        title: "Chat history cleared",
        description: "Conversation history has been reset",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to clear history",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <aside className="w-80 bg-card border-l border-border flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">AI Database Assistant</h3>
            <p className="text-xs text-muted-foreground">Ask questions about your data</p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4" data-testid="chat-messages">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex space-x-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="bg-accent/50 rounded-lg p-3 text-sm">
                  <p className="text-foreground">Hello! I'm your AI database assistant. I can help you:</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground text-xs">
                    <li>• Generate SQL queries from natural language</li>
                    <li>• Explain query results</li>
                    <li>• Suggest optimizations</li>
                    <li>• Answer questions about your data schema</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg: ChatMessage, index) => (
              <div key={msg.id} className={`flex space-x-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                
                <div className={`flex-1 ${msg.role === 'user' ? 'max-w-xs' : ''}`}>
                  <div className={`rounded-lg p-3 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-accent/50'
                  }`}>
                    <p className={msg.role === 'user' ? 'text-primary-foreground' : 'text-foreground'}>
                      {msg.content}
                    </p>
                    
                    {msg.generatedQuery && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                        <div className="text-blue-600 font-medium mb-1">SQL Query:</div>
                        <div className="whitespace-pre-wrap">{msg.generatedQuery}</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-6 px-2 text-xs"
                          onClick={() => onQueryGenerated(msg.generatedQuery!)}
                          data-testid={`button-use-query-${index}`}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Use Query
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {msg.role === 'user' && (
                  <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          
          {isTyping && (
            <div className="flex space-x-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="bg-accent/50 rounded-lg p-3 text-sm">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Chat Input */}
      <div className="p-4 border-t border-border">
        <div className="flex space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={selectedDatabase ? "Ask about your data..." : "Select a database first"}
            disabled={!selectedDatabase || sendMessageMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || !selectedDatabase || sendMessageMutation.isPending}
            size="sm"
            data-testid="button-send-message"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-muted-foreground">
            Press Enter to send
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearHistoryMutation.mutate()}
            disabled={clearHistoryMutation.isPending || messages.length === 0}
            className="text-xs"
            data-testid="button-clear-history"
          >
            {clearHistoryMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <RotateCcw className="w-3 h-3 mr-1" />
            )}
            Clear history
          </Button>
        </div>
      </div>
    </aside>
  );
}
