import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { SavedQuery, Database } from "@shared/schema";
import { ArrowLeft, Play, Edit, Trash2, Search, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDistance } from "date-fns";

interface SavedQueriesPageProps {
  selectedDatabase: Database | null;
  onQueryLoad: (query: string) => void;
}

export default function SavedQueriesPage({ selectedDatabase, onQueryLoad }: SavedQueriesPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: savedQueries = [], isLoading } = useQuery<SavedQuery[]>({
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

  const deleteQueryMutation = useMutation({
    mutationFn: async (queryId: string) => {
      const response = await apiRequest("DELETE", `/api/saved-queries/${queryId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-queries", selectedDatabase?.id] });
      toast({
        title: "Query deleted",
        description: "The saved query has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete query",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleLoadQuery = (query: SavedQuery) => {
    onQueryLoad(query.sqlQuery);
    setLocation("/");
    toast({
      title: "Query loaded",
      description: `"${query.name}" has been loaded into the editor`,
    });
  };

  const filteredQueries = savedQueries.filter(query =>
    query.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (query.description && query.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!selectedDatabase) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">No Database Selected</h2>
          <p className="text-muted-foreground mb-4">Please select a database to view saved queries</p>
          <Link href="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Saved Queries</h1>
              <p className="text-muted-foreground">
                Manage your saved queries for <span className="font-medium">{selectedDatabase.name}</span>
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            {filteredQueries.length} {filteredQueries.length === 1 ? 'query' : 'queries'}
          </Badge>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search queries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-queries"
            />
          </div>
        </div>
      </div>

      {/* Queries List */}
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground">Loading saved queries...</p>
            </div>
          </div>
        ) : filteredQueries.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {searchTerm ? 'No queries found' : 'No saved queries yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms'
                  : 'Save your first query from the SQL editor to get started'
                }
              </p>
              {!searchTerm && (
                <Link href="/">
                  <Button>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go to SQL Editor
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredQueries.map((query) => (
              <Card key={query.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate" data-testid={`query-title-${query.id}`}>
                        {query.name}
                      </CardTitle>
                      {query.description && (
                        <CardDescription className="mt-1 text-sm">
                          {query.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Query Preview */}
                  <div className="mb-4">
                    <div className="bg-muted rounded-md p-3 text-xs font-mono text-muted-foreground max-h-20 overflow-hidden">
                      {query.sqlQuery}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center text-xs text-muted-foreground mb-4 space-x-4">
                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {query.createdAt ? formatDistance(new Date(query.createdAt), new Date(), { addSuffix: true }) : 'Unknown'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleLoadQuery(query)}
                      data-testid={`button-load-query-${query.id}`}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Load
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteQueryMutation.mutate(query.id)}
                      disabled={deleteQueryMutation.isPending}
                      data-testid={`button-delete-query-${query.id}`}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}