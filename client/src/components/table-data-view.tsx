import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database } from "@shared/schema";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface TableDataViewProps {
  selectedDatabase: Database | null;
  selectedTable: string | null;
  onTableDeselect: () => void;
}

interface TableRowsResponse {
  rows: any[];
  rowCount: number;
  pageSize: number;
  message?: string;
}

export default function TableDataView({ 
  selectedDatabase, 
  selectedTable, 
  onTableDeselect 
}: TableDataViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const offset = (currentPage - 1) * pageSize;

  // Fetch table rows using React Query
  const { 
    data: tableData, 
    isLoading, 
    error 
  } = useQuery<TableRowsResponse>({
    queryKey: ['/api/databases', selectedDatabase?.id, 'tables', selectedTable, 'rows', pageSize, offset],
    queryFn: async () => {
      if (!selectedDatabase?.id || !selectedTable) {
        throw new Error('Database or table not selected');
      }
      
      const response = await fetch(
        `/api/databases/${selectedDatabase.id}/tables/${selectedTable}/rows?limit=${pageSize}&offset=${offset}`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!(selectedDatabase?.id && selectedTable),
    staleTime: 30000, // 30 seconds
    retry: 1
  });

  // Extract data for easier access
  const rows = tableData?.rows || [];
  const rowCount = tableData?.rowCount || 0;
  const totalPages = Math.ceil(rowCount / pageSize);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  // Calculate display info
  const startRow = rows.length > 0 ? offset + 1 : 0;
  const endRow = offset + rows.length;

  // Handle pagination
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handlePageSelect = (page: number) => {
    setCurrentPage(page);
  };

  // Reset page when table changes
  const handleBack = () => {
    setCurrentPage(1);
    onTableDeselect();
  };

  // Don't render anything if no table is selected
  if (!selectedDatabase || !selectedTable) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col h-full" data-testid="table-data-view">
      {/* Header Section */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-card">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-back-to-sql-editor"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to SQL Editor
          </Button>
          <div className="text-sm text-muted-foreground">|</div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{selectedTable}</h2>
            <p className="text-sm text-muted-foreground">{selectedDatabase.name}</p>
          </div>
        </div>
        
        {/* Row count info */}
        {!isLoading && !error && (
          <div className="text-sm text-muted-foreground">
            {rowCount > 0 ? (
              <span data-testid="text-row-info">
                Showing {startRow}-{endRow} of {rowCount} rows
              </span>
            ) : (
              <span data-testid="text-row-info">No rows found</span>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          /* Loading State */
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-center space-x-2 text-muted-foreground mb-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading table data...</span>
            </div>
            <div className="space-y-2">
              {/* Loading skeleton */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex space-x-4">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-8 flex-1" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-4">
              <AlertTriangle className="w-12 h-12 mx-auto text-destructive opacity-50" />
              <div>
                <h3 className="font-medium text-foreground mb-2">Failed to load table data</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {error instanceof Error ? error.message : 'An unexpected error occurred'}
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setCurrentPage(1)}
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
                <ArrowLeft className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-2">No data found</h3>
              <p className="text-sm text-muted-foreground">
                This table appears to be empty.
              </p>
            </div>
          </div>
        ) : (
          /* Table Content */
          <div className="p-6">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      {columns.map((column) => (
                        <TableHead 
                          key={column}
                          className="text-left p-3 font-medium text-muted-foreground border-b border-border"
                          data-testid={`table-header-${column}`}
                        >
                          {column}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row: any, index: number) => (
                      <TableRow 
                        key={index}
                        className="border-b border-border hover:bg-accent/50 transition-colors"
                        data-testid={`table-row-${index}`}
                      >
                        {columns.map((column) => (
                          <TableCell 
                            key={column}
                            className="p-3"
                            data-testid={`table-cell-${index}-${column}`}
                          >
                            {row[column] === null || row[column] === undefined 
                              ? <span className="text-muted-foreground italic">null</span>
                              : typeof row[column] === 'number' 
                                ? row[column].toLocaleString()
                                : String(row[column])
                            }
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    
                    {/* Page Numbers */}
                    {(() => {
                      const maxVisiblePages = 5;
                      const pages = [];
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                      
                      // Adjust start if we're near the end
                      if (endPage - startPage + 1 < maxVisiblePages) {
                        startPage = Math.max(1, endPage - maxVisiblePages + 1);
                      }
                      
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <Button
                            key={i}
                            variant={currentPage === i ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageSelect(i)}
                            data-testid={`button-page-${i}`}
                          >
                            {i}
                          </Button>
                        );
                      }
                      
                      return pages;
                    })()}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}