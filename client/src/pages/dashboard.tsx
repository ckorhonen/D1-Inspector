import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DatabaseSidebar from "@/components/database-sidebar";
import SQLEditor from "@/components/sql-editor";
import QueryResults from "@/components/query-results";
import AiChat from "@/components/ai-chat";
import { Database } from "@shared/schema";
import { Loader2, Bot, Bell, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
  const [currentQuery, setCurrentQuery] = useState("");
  const [queryResults, setQueryResults] = useState<any>(null);
  const [showAiChat, setShowAiChat] = useState(true);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState({
    name: "",
    cloudflareToken: "",
    accountId: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: databases, isLoading: databasesLoading } = useQuery({
    queryKey: ["/api/databases"],
  });

  const { data: apiKeys } = useQuery({
    queryKey: ["/api/api-keys"],
  });

  const createApiKeyMutation = useMutation({
    mutationFn: async (data: typeof apiKeyForm) => {
      const response = await apiRequest("POST", "/api/api-keys", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/databases"] });
      setShowApiKeyDialog(false);
      setApiKeyForm({ name: "", cloudflareToken: "", accountId: "" });
      toast({
        title: "Success",
        description: "API key configured successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to configure API key",
        variant: "destructive",
      });
    },
  });

  const hasActiveApiKey = apiKeys && Array.isArray(apiKeys) && apiKeys.some((key: any) => key.isActive);

  if (!hasActiveApiKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to D1 Query Studio</h1>
          <p className="text-muted-foreground">
            Configure your Cloudflare API key to get started with your database analytics.
          </p>
          
          <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
            <DialogTrigger asChild>
              <Button 
                size="lg" 
                className="mt-4"
                data-testid="button-configure-api-welcome"
              >
                <Settings className="w-4 h-4 mr-2" />
                Configure API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure Cloudflare API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Configuration Name</Label>
                  <Input
                    id="name"
                    value={apiKeyForm.name}
                    onChange={(e) => setApiKeyForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Production"
                    data-testid="input-api-name"
                  />
                </div>
                <div>
                  <Label htmlFor="token">Cloudflare API Token</Label>
                  <Input
                    id="token"
                    type="password"
                    value={apiKeyForm.cloudflareToken}
                    onChange={(e) => setApiKeyForm(prev => ({ ...prev, cloudflareToken: e.target.value }))}
                    placeholder="Your Cloudflare API token"
                    data-testid="input-api-token"
                  />
                </div>
                <div>
                  <Label htmlFor="accountId">Account ID</Label>
                  <Input
                    id="accountId"
                    value={apiKeyForm.accountId}
                    onChange={(e) => setApiKeyForm(prev => ({ ...prev, accountId: e.target.value }))}
                    placeholder="Your Cloudflare account ID"
                    data-testid="input-account-id"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowApiKeyDialog(false)}
                    data-testid="button-cancel-api"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createApiKeyMutation.mutate(apiKeyForm)}
                    disabled={createApiKeyMutation.isPending || !apiKeyForm.name || !apiKeyForm.cloudflareToken || !apiKeyForm.accountId}
                    data-testid="button-save-api"
                  >
                    {createApiKeyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Save Configuration
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DatabaseSidebar 
        databases={databases && Array.isArray(databases) ? databases : []}
        selectedDatabase={selectedDatabase}
        onSelectDatabase={setSelectedDatabase}
        isLoading={databasesLoading}
        data-testid="database-sidebar"
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-foreground">SQL Query Editor</h2>
            {selectedDatabase && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span data-testid="selected-database">{selectedDatabase.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowAiChat(!showAiChat)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="button-toggle-ai"
            >
              <Bot className="w-4 h-4" />
              <span>AI Assistant</span>
            </button>
            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
              <User className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <SQLEditor 
              selectedDatabase={selectedDatabase}
              currentQuery={currentQuery}
              onQueryChange={setCurrentQuery}
              onQueryExecute={setQueryResults}
              data-testid="sql-editor"
            />
            
            <QueryResults 
              results={queryResults}
              selectedDatabase={selectedDatabase}
              data-testid="query-results"
            />
          </main>

          {/* AI Chat Sidebar */}
          {showAiChat && (
            <AiChat 
              selectedDatabase={selectedDatabase}
              queryResults={queryResults}
              onQueryGenerated={setCurrentQuery}
              data-testid="ai-chat"
            />
          )}
        </div>
      </div>
    </div>
  );
}
