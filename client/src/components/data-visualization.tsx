import { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Maximize2 } from "lucide-react";

interface DataVisualizationProps {
  data: any[];
  columns: string[];
}

export default function DataVisualization({ data, columns }: DataVisualizationProps) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [xAxis, setXAxis] = useState<string>(columns[0] || '');
  const [yAxis, setYAxis] = useState<string>('');

  // Find numeric columns for Y-axis
  const numericColumns = useMemo(() => {
    if (!data.length) return [];
    
    return columns.filter(col => {
      const values = data.slice(0, 10).map(row => row[col]);
      return values.some(val => typeof val === 'number' && !isNaN(val));
    });
  }, [data, columns]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!xAxis || !yAxis) return [];
    
    // For pie chart, aggregate data
    if (chartType === 'pie') {
      const aggregated = data.reduce((acc, row) => {
        const key = String(row[xAxis]);
        const value = Number(row[yAxis]) || 0;
        acc[key] = (acc[key] || 0) + value;
        return acc;
      }, {} as Record<string, number>);
      
      return Object.entries(aggregated)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8); // Limit to top 8 for readability
    }
    
    // For bar/line charts, use first 20 rows
    return data.slice(0, 20).map(row => ({
      [xAxis]: String(row[xAxis]),
      [yAxis]: Number(row[yAxis]) || 0,
    }));
  }, [data, xAxis, yAxis, chartType]);

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  if (!numericColumns.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h4 className="font-medium text-foreground mb-4">Data Visualization</h4>
        <div className="text-center py-8 text-muted-foreground">
          No numeric columns found for visualization
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h4 className="font-medium text-foreground">Data Visualization</h4>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart Controls */}
        <div className="bg-card border border-border rounded-lg p-4 chart-container">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Chart Type</label>
              <div className="flex space-x-2">
                <Button
                  variant={chartType === 'bar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('bar')}
                  data-testid="button-chart-bar"
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('line')}
                  data-testid="button-chart-line"
                >
                  <LineChartIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant={chartType === 'pie' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('pie')}
                  data-testid="button-chart-pie"
                >
                  <PieChartIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">X-Axis</label>
              <Select value={xAxis} onValueChange={setXAxis}>
                <SelectTrigger data-testid="select-x-axis">
                  <SelectValue placeholder="Select X-axis column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Y-Axis</label>
              <Select value={yAxis} onValueChange={setYAxis}>
                <SelectTrigger data-testid="select-y-axis">
                  <SelectValue placeholder="Select Y-axis column" />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Chart Display */}
        <div className="bg-card border border-border rounded-lg p-4 chart-container">
          <div className="flex items-center justify-between mb-4">
            <h5 className="font-medium text-sm">
              {yAxis ? `${yAxis} by ${xAxis}` : 'Select axes to view chart'}
            </h5>
            <Button variant="ghost" size="sm" data-testid="button-expand-chart">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
          
          {xAxis && yAxis && chartData.length > 0 ? (
            <div className="h-64" data-testid="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' && (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey={xAxis} 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey={yAxis} fill="hsl(var(--primary))" />
                  </BarChart>
                )}
                
                {chartType === 'line' && (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey={xAxis} 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey={yAxis} 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                )}
                
                {chartType === 'pie' && (
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {!xAxis || !yAxis 
                    ? 'Select both X and Y axes to display chart' 
                    : 'No data available for selected columns'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
