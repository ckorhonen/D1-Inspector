import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Database } from "@shared/schema";
import { Play, Save, Share, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SQLEditorProps {
  selectedDatabase: Database | null;
  currentQuery: string;
  onQueryChange: (query: string) => void;
  onQueryExecute: (results: any) => void;
}

export default function SQLEditor({ 
  selectedDatabase, 
  currentQuery, 
  onQueryChange, 
  onQueryExecute 
}: SQLEditorProps) {
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryName, setQueryName] = useState("");
  const [queryDescription, setQueryDescription] = useState("");
  const { toast } = useToast();

  const executeQueryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDatabase || !currentQuery.trim()) {
        throw new Error("Please select a database and enter a query");
      }
      const response = await apiRequest("POST", `/api/databases/${selectedDatabase.id}/query`, {
        query: currentQuery
      });
      return response.json();
    },
    onSuccess: (data) => {
      onQueryExecute(data);
      toast({
        title: "Query executed successfully",
        description: `${data.rowCount || 0} rows returned in ${data.executionTime || 'N/A'}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Query execution failed",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const generateQueryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDatabase || !naturalLanguageQuery.trim()) {
        throw new Error("Please select a database and enter a description");
      }
      const response = await apiRequest("POST", "/api/ai/generate-query", {
        naturalLanguageQuery,
        databaseId: selectedDatabase.id
      });
      return response.json();
    },
    onSuccess: (data) => {
      onQueryChange(data.query);
      setNaturalLanguageQuery("");
      toast({
        title: "SQL query generated",
        description: data.explanation,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate query",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const saveQueryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDatabase || !currentQuery.trim() || !queryName.trim()) {
        throw new Error("Please provide a query name");
      }
      const response = await apiRequest("POST", "/api/saved-queries", {
        name: queryName,
        description: queryDescription,
        sqlQuery: currentQuery,
        databaseId: selectedDatabase.id
      });
      return response.json();
    },
    onSuccess: () => {
      setShowSaveDialog(false);
      setQueryName("");
      setQueryDescription("");
      toast({
        title: "Query saved successfully",
        description: "Your query has been saved for future use",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save query",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      executeQueryMutation.mutate();
    }
  };

  return (
    <div className="p-6 border-b border-border">
      <div className="space-y-4">
        {/* AI Query Generator */}
        <div className="bg-accent/30 border border-border rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Wand2 className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-foreground">AI Query Generator</h3>
          </div>
          <div className="flex space-x-3">
            <Input
              value={naturalLanguageQuery}
              onChange={(e) => setNaturalLanguageQuery(e.target.value)}
              placeholder="Describe what you want to query... e.g., 'Show me all users who signed up last month'"
              className="flex-1"
              onKeyPress={(e) => e.key === 'Enter' && generateQueryMutation.mutate()}
              data-testid="input-natural-query"
            />
            <Button
              onClick={() => generateQueryMutation.mutate()}
              disabled={generateQueryMutation.isPending || !selectedDatabase || !naturalLanguageQuery.trim()}
              data-testid="button-generate-sql"
            >
              {generateQueryMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Generate SQL
            </Button>
          </div>
        </div>

        {/* SQL Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">SQL Query</h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                disabled={!currentQuery.trim()}
                data-testid="button-save-query"
              >
                <Save className="w-4 h-4 mr-1" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(currentQuery)}
                disabled={!currentQuery.trim()}
                data-testid="button-share-query"
              >
                <Share className="w-4 h-4 mr-1" />
                Share
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <Textarea
              value={currentQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={selectedDatabase ? "Enter your SQL query here..." : "Please select a database first"}
              className="sql-editor min-h-[200px] font-mono text-sm resize-none"
              disabled={!selectedDatabase}
              data-testid="textarea-sql-query"
            />
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              {selectedDatabase ? (
                <span>Ready to execute • Press Ctrl+Enter to run</span>
              ) : (
                <span>Please select a database to continue</span>
              )}
            </div>
            <Button
              onClick={() => executeQueryMutation.mutate()}
              disabled={executeQueryMutation.isPending || !selectedDatabase || !currentQuery.trim()}
              data-testid="button-run-query"
            >
              {executeQueryMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Run Query
            </Button>
          </div>
        </div>
      </div>

      {/* Save Query Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg w-full max-w-md mx-4">
            <h3 className="text-lg font-medium mb-4">Save Query</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Query Name</label>
                <Input
                  value={queryName}
                  onChange={(e) => setQueryName(e.target.value)}
                  placeholder="Enter a name for this query"
                  data-testid="input-query-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                <Textarea
                  value={queryDescription}
                  onChange={(e) => setQueryDescription(e.target.value)}
                  placeholder="Describe what this query does"
                  rows={3}
                  data-testid="textarea-query-description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSaveDialog(false)}
                  data-testid="button-cancel-save"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveQueryMutation.mutate()}
                  disabled={saveQueryMutation.isPending || !queryName.trim()}
                  data-testid="button-confirm-save"
                >
                  {saveQueryMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Save Query
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
