import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Database, ApiKey, SavedQuery } from "@shared/schema";
import { Database as DatabaseIcon, Settings, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DatabaseSidebarProps {
  databases: Database[];
  selectedDatabase: Database | null;
  onSelectDatabase: (database: Database) => void;
  isLoading: boolean;
}

export default function DatabaseSidebar({ 
  databases, 
  selectedDatabase, 
  onSelectDatabase, 
  isLoading 
}: DatabaseSidebarProps) {
  const [location] = useLocation();
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState({
    name: "",
    cloudflareToken: "",
    accountId: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: apiKeys = [] } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
    queryFn: async () => {
      const response = await fetch("/api/api-keys");
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const { data: savedQueries = [] } = useQuery<SavedQuery[]>({
    queryKey: ["/api/saved-queries", selectedDatabase?.id],
    queryFn: async () => {
      const response = await fetch(`/api/saved-queries?databaseId=${selectedDatabase?.id}`);
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!selectedDatabase?.id,
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

  const activeApiKey = apiKeys?.find((key: ApiKey) => key.isActive);

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo and Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <DatabaseIcon className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">D1 Query Studio</h1>
            <p className="text-xs text-muted-foreground">Cloudflare Analytics</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Analytics
          </h3>
          <Link href="/">
            <Button
              variant={location === "/" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start text-sm"
              data-testid="nav-query-editor"
            >
              <DatabaseIcon className="w-4 h-4 mr-3" />
              Query Editor
            </Button>
          </Link>
          <Link href="/saved-queries">
            <Button
              variant={location === "/saved-queries" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start text-sm"
              data-testid="nav-saved-queries"
            >
              <Plus className="w-4 h-4 mr-3" />
              Saved Queries ({savedQueries?.length || 0})
            </Button>
          </Link>
        </div>

        {/* Databases */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Databases
          </h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : databases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No databases found</p>
          ) : (
            <div className="space-y-1">
              {databases.map((db) => (
                <button
                  key={db.id}
                  onClick={() => onSelectDatabase(db)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm w-full text-left transition-colors ${
                    selectedDatabase?.id === db.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  data-testid={`database-${db.id}`}
                >
                  <DatabaseIcon className="w-4 h-4 text-green-500" />
                  <span className="truncate">{db.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* API Key Status */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-2 text-sm mb-2">
          {activeApiKey ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span className="text-muted-foreground">Connected to Cloudflare</span>
            </>
          ) : (
            <>
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-muted-foreground">Not connected</span>
            </>
          )}
        </div>
        
        <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-xs text-primary hover:text-primary/80"
              data-testid="button-configure-api"
            >
              <Settings className="w-3 h-3 mr-1" />
              {activeApiKey ? 'Reconfigure API Key' : 'Configure API Key'}
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
    </aside>
  );
}
