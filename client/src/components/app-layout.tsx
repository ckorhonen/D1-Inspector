import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DatabaseSidebar from "@/components/database-sidebar";
import SQLEditor from "@/components/sql-editor";
import QueryResults from "@/components/query-results";
import AiChat from "@/components/ai-chat";
import SavedQueriesPage from "@/pages/saved-queries";
import TableDataView from "@/components/table-data-view";
import { Database } from "@shared/schema";
import { Database as DatabaseIcon, Loader2, Bot, Bell, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AppLayout() {
  const [location] = useLocation();
  const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
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

  const { data: databases = [], isLoading: databasesLoading } = useQuery<Database[]>({
    queryKey: ["/api/databases"],
    queryFn: async () => {
      const response = await fetch("/api/databases");
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const { data: apiKeys = [] } = useQuery({
    queryKey: ["/api/api-keys"],
    queryFn: async () => {
      const response = await fetch("/api/api-keys");
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
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

  const activeApiKey = apiKeys.find((key: any) => key.isActive);

  // Handle table selection
  const handleTableSelect = (database: Database, tableName: string) => {
    // First select the database if it's not already selected
    if (selectedDatabase?.id !== database.id) {
      setSelectedDatabase(database);
    }
    
    // Set the selected table to switch to table view
    setSelectedTable(tableName);
    
    // Show a toast notification
    toast({
      title: "Table Selected",
      description: `Viewing data for table "${tableName}"`,
    });
  };

  // Handle table deselection (back to SQL editor)
  const handleTableDeselect = () => {
    setSelectedTable(null);
  };

  // Reset selectedTable when database changes
  const handleDatabaseSelect = (database: Database) => {
    setSelectedDatabase(database);
    setSelectedTable(null); // Reset table selection when database changes
  };

  // Show welcome screen if no API key is configured
  if (!databasesLoading && (!apiKeys || apiKeys.length === 0)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <DatabaseIcon className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to D1 Query Studio</h1>
            <p className="text-muted-foreground">
              Get started by configuring your Cloudflare API credentials to connect to your D1 databases.
            </p>
          </div>

          <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
            <DialogTrigger asChild>
              <Button className="w-full" data-testid="button-configure-first-api">
                <Settings className="w-4 h-4 mr-2" />
                Configure Cloudflare API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure Cloudflare API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">API Key Name</Label>
                  <Input
                    id="name"
                    value={apiKeyForm.name}
                    onChange={(e) => setApiKeyForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Cloudflare API Key"
                    data-testid="input-api-key-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token">Cloudflare API Token</Label>
                  <Input
                    id="token"
                    type="password"
                    value={apiKeyForm.cloudflareToken}
                    onChange={(e) => setApiKeyForm(prev => ({ ...prev, cloudflareToken: e.target.value }))}
                    placeholder="Your Cloudflare API token"
                    data-testid="input-cloudflare-token"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountId">Account ID</Label>
                  <Input
                    id="accountId"
                    value={apiKeyForm.accountId}
                    onChange={(e) => setApiKeyForm(prev => ({ ...prev, accountId: e.target.value }))}
                    placeholder="Your Cloudflare account ID"
                    data-testid="input-account-id"
                  />
                </div>
                <Button
                  onClick={() => createApiKeyMutation.mutate(apiKeyForm)}
                  disabled={createApiKeyMutation.isPending || !apiKeyForm.name || !apiKeyForm.cloudflareToken || !apiKeyForm.accountId}
                  className="w-full"
                  data-testid="button-save-api-key"
                >
                  {createApiKeyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save API Key
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // Main application layout
  return (
    <div className="flex h-screen bg-background">
      <DatabaseSidebar
        databases={databases}
        selectedDatabase={selectedDatabase}
        onSelectDatabase={handleDatabaseSelect}
        onTableSelect={handleTableSelect}
        isLoading={databasesLoading}
      />

      {location === "/saved-queries" ? (
        <SavedQueriesPage
          selectedDatabase={selectedDatabase}
          onQueryLoad={setCurrentQuery}
        />
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="border-b border-border bg-background">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-foreground">SQL Query Editor</h2>
                {selectedDatabase && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-muted-foreground">{selectedDatabase.name}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" data-testid="button-notifications">
                  <Bell className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" data-testid="button-user">
                  <User className="w-4 h-4" />
                </Button>
                <Button
                  variant={showAiChat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAiChat(!showAiChat)}
                  data-testid="button-toggle-ai"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  AI Assistant
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex">
            {selectedTable ? (
              // Table Data View
              <TableDataView
                selectedDatabase={selectedDatabase}
                selectedTable={selectedTable}
                onTableDeselect={handleTableDeselect}
              />
            ) : (
              // SQL Editor View
              <>
                <div className="flex-1 flex flex-col">
                  <SQLEditor
                    selectedDatabase={selectedDatabase}
                    currentQuery={currentQuery}
                    onQueryChange={setCurrentQuery}
                    onQueryExecute={setQueryResults}
                  />
                  <QueryResults results={queryResults} selectedDatabase={selectedDatabase} />
                </div>

                {showAiChat && (
                  <AiChat
                    selectedDatabase={selectedDatabase}
                    queryResults={queryResults}
                    onQueryGenerated={setCurrentQuery}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}