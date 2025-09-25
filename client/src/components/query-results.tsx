import { useState, useMemo } from "react";
import { Database } from "@shared/schema";
import { Download, BarChart3, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataVisualization from "@/components/data-visualization";
import { exportData } from "@/lib/export";

interface QueryResultsProps {
  results: any;
  selectedDatabase: Database | null;
}

export default function QueryResults({ results, selectedDatabase }: QueryResultsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showVisualization, setShowVisualization] = useState(false);
  const itemsPerPage = 10;

  const sortedData = useMemo(() => {
    if (!results?.results || !sortColumn) return results?.results || [];
    
    return [...results.results].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [results?.results, sortColumn, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil((sortedData.length || 0) / itemsPerPage);
  const columns = results?.results?.[0] ? Object.keys(results.results[0]) : [];

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!results?.results) return;
    
    try {
      await exportData(results.results, format, `query-results-${Date.now()}`);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (!results) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Execute a query to see results here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h3 className="font-medium text-foreground">Query Results</h3>
            <div className="text-sm text-muted-foreground">
              <span data-testid="text-row-count">{results.rowCount || 0} rows</span> • 
              <span data-testid="text-execution-time" className="ml-1">{results.executionTime || 'N/A'}</span>
              {results.cached && <span className="ml-1 text-primary">(cached)</span>}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={!results.results?.length}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
              disabled={!results.results?.length}
              data-testid="button-export-json"
            >
              <Download className="w-4 h-4 mr-1" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVisualization(!showVisualization)}
              disabled={!results.results?.length}
              data-testid="button-toggle-visualization"
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              {showVisualization ? 'Hide' : 'Visualize'}
            </Button>
          </div>
        </div>

        {/* Data Table */}
        {results.results?.length > 0 ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted">
                    {columns.map((column) => (
                      <TableHead 
                        key={column}
                        className="text-left p-3 font-medium text-muted-foreground border-b border-border cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort(column)}
                        data-testid={`header-${column}`}
                      >
                        <div className="flex items-center space-x-1">
                          <span>{column}</span>
                          <ArrowUpDown className="w-3 h-3" />
                          {sortColumn === column && (
                            <span className="text-primary text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((row: any, index: number) => (
                    <TableRow 
                      key={index}
                      className="border-b border-border hover:bg-accent/50 transition-colors"
                      data-testid={`row-${index}`}
                    >
                      {columns.map((column) => (
                        <TableCell 
                          key={column}
                          className="p-3"
                          data-testid={`cell-${index}-${column}`}
                        >
                          {typeof row[column] === 'number' 
                            ? row[column].toLocaleString()
                            : String(row[column] || '')
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
                  Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        data-testid={`button-page-${page}`}
                      >
                        {page}
                      </Button>
                    );
                  })}
                  
                  {totalPages > 5 && (
                    <>
                      <span className="px-2 text-muted-foreground">...</span>
                      <Button
                        variant={currentPage === totalPages ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        data-testid={`button-page-${totalPages}`}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
        ) : (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground">No results found</p>
          </div>
        )}

        {/* Data Visualization */}
        {showVisualization && results.results?.length > 0 && (
          <div className="mt-6">
            <DataVisualization 
              data={results.results} 
              columns={columns}
              data-testid="data-visualization"
            />
          </div>
        )}
      </div>
    </div>
  );
}
