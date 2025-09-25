import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { CloudflareD1Service, CloudflareUserError, CloudflareSystemError } from "./services/cloudflare";
import { openAIService } from "./services/openai";
import { insertApiKeySchema, insertSavedQuerySchema, insertChatMessageSchema } from "@shared/schema";
import { createHash } from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  // API Key management
  app.post("/api/api-keys", async (req, res) => {
    try {
      const data = insertApiKeySchema.parse(req.body);
      
      // Test the API key by trying to list databases
      const cloudflare = new CloudflareD1Service(data.accountId, data.cloudflareToken);
      await cloudflare.listDatabases(); // This will throw if invalid
      
      // Deactivate other API keys
      const existingKeys = await storage.getApiKeys();
      for (const key of existingKeys) {
        await storage.updateApiKey(key.id, { isActive: false });
      }
      
      const apiKey = await storage.createApiKey(data);
      // Don't expose sensitive token in response
      const safeApiKey = {
        id: apiKey.id,
        name: apiKey.name,
        accountId: apiKey.accountId,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt
      };
      res.json(safeApiKey);
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to create API key" 
      });
    }
  });

  app.get("/api/api-keys", async (req, res) => {
    try {
      const apiKeys = await storage.getApiKeys();
      // Don't expose sensitive tokens in response
      const safeApiKeys = apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        accountId: key.accountId,
        isActive: key.isActive,
        createdAt: key.createdAt
      }));
      res.json(safeApiKeys);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch API keys" 
      });
    }
  });

  app.delete("/api/api-keys/:id", async (req, res) => {
    try {
      const success = await storage.deleteApiKey(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "API key not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete API key" 
      });
    }
  });

  // Database management
  app.get("/api/databases", async (req, res) => {
    try {
      const apiKey = await storage.getActiveApiKey();
      if (!apiKey) {
        return res.status(400).json({ message: "No active API key configured" });
      }

      // In development mode with mock credentials, return mock databases
      if (process.env.NODE_ENV === "development" && apiKey.cloudflareToken === "mock-token-for-testing") {
        const databases = await storage.getDatabases();
        const mockDatabases = databases.map(db => ({
          id: db.id,  // Use id field to match frontend expectations
          uuid: db.id,  // Keep uuid for Cloudflare API compatibility
          name: db.name,
          created_at: db.createdAt?.toISOString() || new Date().toISOString(),
          version: "1.0",
          running_in_region: "dev"
        }));
        return res.json(mockDatabases);
      }

      const cloudflare = new CloudflareD1Service(apiKey.accountId, apiKey.cloudflareToken);
      const cloudflareResponse = await cloudflare.listDatabases();
      
      // Store/update databases in local storage and format response for frontend
      const databases = [];
      for (const db of cloudflareResponse) {
        await storage.createDatabase({
          id: db.uuid,
          name: db.name,
          accountId: apiKey.accountId,
        });
        
        // Format response to include both id and uuid fields for frontend compatibility
        databases.push({
          id: db.uuid,  // Frontend expects id field
          uuid: db.uuid,  // Keep original uuid field for API compatibility
          name: db.name,
          created_at: db.created_at,
          version: db.version,
          running_in_region: db.running_in_region
        });
      }

      res.json(databases);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch databases" 
      });
    }
  });

  app.get("/api/databases/:id/schema", async (req, res) => {
    try {
      const apiKey = await storage.getActiveApiKey();
      if (!apiKey) {
        return res.status(400).json({ message: "No active API key configured" });
      }

      const cloudflare = new CloudflareD1Service(apiKey.accountId, apiKey.cloudflareToken);
      const schema = await cloudflare.getDatabaseSchema(req.params.id);
      
      res.json(schema);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch database schema" 
      });
    }
  });

  // Table rows endpoint with pagination
  app.get("/api/databases/:id/tables/:table/rows", async (req, res) => {
    const startTime = Date.now();
    const { id: databaseId, table: tableName } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    try {
      // Validate pagination parameters
      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({ 
          message: "Limit must be a number between 1 and 100",
          rows: [],
          rowCount: 0,
          pageSize: 0
        });
      }

      if (isNaN(offsetNum) || offsetNum < 0) {
        return res.status(400).json({ 
          message: "Offset must be a non-negative number",
          rows: [],
          rowCount: 0,
          pageSize: 0
        });
      }

      const apiKey = await storage.getActiveApiKey();
      if (!apiKey) {
        return res.status(400).json({ 
          message: "No active API key configured",
          rows: [],
          rowCount: 0,
          pageSize: 0
        });
      }

      const cloudflare = new CloudflareD1Service(apiKey.accountId, apiKey.cloudflareToken);

      // Validate table name against database schema
      const schema = await cloudflare.getDatabaseSchema(databaseId);
      const tableExists = schema.some(item => 
        item.type === 'table' && item.name === tableName
      );

      if (!tableExists) {
        const executionTime = `${Date.now() - startTime}ms`;
        console.log('[TABLE_ROWS USER_ERROR]', JSON.stringify({
          dbId: databaseId,
          tableName,
          duration: executionTime,
          errorType: 'TableNotFound',
          errorMessage: `Table '${tableName}' does not exist`,
          timestamp: new Date().toISOString()
        }));

        return res.status(400).json({ 
          message: `Table '${tableName}' does not exist`,
          rows: [],
          rowCount: 0,
          pageSize: limitNum
        });
      }

      // In development mode with mock credentials, return mock table data
      if (process.env.NODE_ENV === "development" && apiKey.cloudflareToken === "mock-token-for-testing") {
        let mockRows: any[] = [];
        
        if (databaseId === 'db-test-1' && tableName === 'users') {
          const allUsers = [
            { id: 1, name: 'Alice Johnson', email: 'alice@example.com', created_at: '2024-01-15', status: 'active' },
            { id: 2, name: 'Bob Smith', email: 'bob@example.com', created_at: '2024-01-20', status: 'active' },
            { id: 3, name: 'Carol Davis', email: 'carol@example.com', created_at: '2024-02-01', status: 'inactive' },
            { id: 4, name: 'David Wilson', email: 'david@example.com', created_at: '2024-02-15', status: 'active' },
            { id: 5, name: 'Eva Brown', email: 'eva@example.com', created_at: '2024-03-01', status: 'active' },
            { id: 6, name: 'Frank Miller', email: 'frank@example.com', created_at: '2024-03-10', status: 'active' },
            { id: 7, name: 'Grace Lee', email: 'grace@example.com', created_at: '2024-03-15', status: 'inactive' }
          ];
          mockRows = allUsers.slice(offsetNum, offsetNum + limitNum);
        } else if (databaseId === 'db-test-2' && tableName === 'analytics') {
          const allAnalytics = [
            { date: '2024-03-01', page_views: 1250, unique_visitors: 820, bounce_rate: 0.35 },
            { date: '2024-03-02', page_views: 1380, unique_visitors: 920, bounce_rate: 0.32 },
            { date: '2024-03-03', page_views: 1150, unique_visitors: 750, bounce_rate: 0.38 },
            { date: '2024-03-04', page_views: 1420, unique_visitors: 980, bounce_rate: 0.30 },
            { date: '2024-03-05', page_views: 1320, unique_visitors: 850, bounce_rate: 0.34 },
            { date: '2024-03-06', page_views: 1480, unique_visitors: 1020, bounce_rate: 0.29 },
            { date: '2024-03-07', page_views: 1350, unique_visitors: 880, bounce_rate: 0.33 }
          ];
          mockRows = allAnalytics.slice(offsetNum, offsetNum + limitNum);
        }

        const executionTime = `${Date.now() - startTime}ms`;
        
        // Structured logging for successful table rows fetch
        console.log('[TABLE_ROWS SUCCESS]', JSON.stringify({
          dbId: databaseId,
          tableName,
          duration: executionTime,
          rowCount: mockRows.length,
          pageSize: limitNum,
          offset: offsetNum,
          timestamp: new Date().toISOString()
        }));

        return res.json({
          rows: mockRows,
          rowCount: mockRows.length,
          pageSize: limitNum
        });
      }

      // Build safe SQL query with identifier quoting to prevent SQL injection
      const query = `SELECT * FROM "${tableName}" LIMIT ${limitNum} OFFSET ${offsetNum}`;
      
      const result = await cloudflare.executeQuery(databaseId, query);
      const executionTime = `${Date.now() - startTime}ms`;

      // Structured logging for successful table rows fetch
      console.log('[TABLE_ROWS SUCCESS]', JSON.stringify({
        dbId: databaseId,
        tableName,
        duration: executionTime,
        rowCount: result.results.length,
        pageSize: limitNum,
        offset: offsetNum,
        timestamp: new Date().toISOString()
      }));

      res.json({
        rows: result.results,
        rowCount: result.results.length,
        pageSize: limitNum
      });

    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      
      // Structured logging for errors
      const logData = {
        dbId: databaseId,
        tableName,
        duration: executionTime,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };

      if (error instanceof CloudflareUserError) {
        // User errors should return 400
        console.log('[TABLE_ROWS USER_ERROR]', JSON.stringify(logData));
        res.status(400).json({ 
          message: error.message,
          rows: [],
          rowCount: 0,
          pageSize: parseInt(limit as string, 10) || 50
        });
      } else if (error instanceof CloudflareSystemError) {
        // System errors should return 500
        console.error('[TABLE_ROWS SYSTEM_ERROR]', JSON.stringify(logData));
        res.status(500).json({ 
          message: "Internal server error occurred while fetching table data",
          rows: [],
          rowCount: 0,
          pageSize: parseInt(limit as string, 10) || 50
        });
      } else {
        // Unknown errors default to 500
        console.error('[TABLE_ROWS UNKNOWN_ERROR]', JSON.stringify(logData));
        res.status(500).json({ 
          message: "Failed to fetch table data",
          rows: [],
          rowCount: 0,
          pageSize: parseInt(limit as string, 10) || 50
        });
      }
    }
  });

  // Query execution
  app.post("/api/databases/:id/query", async (req, res) => {
    const startTime = Date.now();
    let queryHash = '';
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ message: "Query is required" });
      }

      const apiKey = await storage.getActiveApiKey();
      if (!apiKey) {
        return res.status(400).json({ message: "No active API key configured" });
      }

      // Check cache first
      queryHash = createHash('md5').update(query).digest('hex');
      const cached = await storage.getQueryResult(queryHash, req.params.id);
      
      if (cached && cached.createdAt && Date.now() - cached.createdAt.getTime() < 5 * 60 * 1000) {
        return res.json({
          results: cached.results,
          executionTime: cached.executionTime,
          rowCount: parseInt(cached.rowCount || '0') || 0,
          cached: true
        });
      }

      // In development mode with mock credentials, return mock query results
      if (process.env.NODE_ENV === "development" && apiKey.cloudflareToken === "mock-token-for-testing") {
        const startTime = Date.now();
        
        // Generate mock results based on query
        let mockResults: any[] = [];
        if (query.toLowerCase().includes('select')) {
          if (req.params.id === 'db-test-1') {
            // Users Database mock data
            mockResults = [
              { id: 1, name: 'Alice Johnson', email: 'alice@example.com', created_at: '2024-01-15', status: 'active' },
              { id: 2, name: 'Bob Smith', email: 'bob@example.com', created_at: '2024-01-20', status: 'active' },
              { id: 3, name: 'Carol Davis', email: 'carol@example.com', created_at: '2024-02-01', status: 'inactive' },
              { id: 4, name: 'David Wilson', email: 'david@example.com', created_at: '2024-02-15', status: 'active' },
              { id: 5, name: 'Eva Brown', email: 'eva@example.com', created_at: '2024-03-01', status: 'active' }
            ];
          } else if (req.params.id === 'db-test-2') {
            // Analytics Database mock data
            mockResults = [
              { date: '2024-03-01', page_views: 1250, unique_visitors: 820, bounce_rate: 0.35 },
              { date: '2024-03-02', page_views: 1380, unique_visitors: 920, bounce_rate: 0.32 },
              { date: '2024-03-03', page_views: 1150, unique_visitors: 750, bounce_rate: 0.38 },
              { date: '2024-03-04', page_views: 1420, unique_visitors: 980, bounce_rate: 0.30 },
              { date: '2024-03-05', page_views: 1320, unique_visitors: 850, bounce_rate: 0.34 }
            ];
          }
        }
        
        const executionTime = `${Date.now() - startTime}ms`;

        // Cache the result
        await storage.createQueryResult({
          queryHash,
          databaseId: req.params.id,
          results: mockResults,
          executionTime,
          rowCount: mockResults.length.toString(),
        });

        return res.json({
          results: mockResults,
          executionTime,
          rowCount: mockResults.length,
          changes: 0,
          cached: false
        });
      }

      const cloudflare = new CloudflareD1Service(apiKey.accountId, apiKey.cloudflareToken);
      const result = await cloudflare.executeQuery(req.params.id, query);
      const executionTime = `${Date.now() - startTime}ms`;

      // Structured logging for successful queries
      console.log('[QUERY SUCCESS]', JSON.stringify({
        dbId: req.params.id,
        queryHash,
        duration: executionTime,
        rowCount: result.results.length,
        timestamp: new Date().toISOString()
      }));

      // Cache the result
      await storage.createQueryResult({
        queryHash,
        databaseId: req.params.id,
        results: result.results,
        executionTime,
        rowCount: result.results.length.toString(),
      });

      res.json({
        results: result.results,
        executionTime,
        rowCount: result.results.length,
        changes: result.changes,
        cached: false
      });
    } catch (error) {
      const executionTime = `${Date.now() - startTime}ms`;
      
      // Structured logging for errors
      const logData = {
        dbId: req.params.id,
        queryHash,
        duration: executionTime,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      };

      if (error instanceof CloudflareUserError) {
        // User SQL errors should return 400
        console.log('[QUERY USER_ERROR]', JSON.stringify(logData));
        res.status(400).json({ 
          message: error.message,
          results: [],
          rowCount: 0,
          executionTime
        });
      } else if (error instanceof CloudflareSystemError) {
        // System errors should return 500
        console.error('[QUERY SYSTEM_ERROR]', JSON.stringify(logData));
        res.status(500).json({ 
          message: "Internal server error occurred while executing query",
          results: [],
          rowCount: 0,
          executionTime
        });
      } else {
        // Unknown errors default to 500
        console.error('[QUERY UNKNOWN_ERROR]', JSON.stringify(logData));
        res.status(500).json({ 
          message: "Failed to execute query",
          results: [],
          rowCount: 0,
          executionTime
        });
      }
    }
  });

  // AI features
  app.post("/api/ai/generate-query", async (req, res) => {
    try {
      const { naturalLanguageQuery, databaseId } = req.body;
      if (!naturalLanguageQuery || !databaseId) {
        return res.status(400).json({ message: "Natural language query and database ID are required" });
      }

      const apiKey = await storage.getActiveApiKey();
      if (!apiKey) {
        return res.status(400).json({ message: "No active API key configured" });
      }

      const cloudflare = new CloudflareD1Service(apiKey.accountId, apiKey.cloudflareToken);
      const schema = await cloudflare.getDatabaseSchema(databaseId);
      
      const result = await openAIService.generateSQLQuery(naturalLanguageQuery, schema);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to generate SQL query" 
      });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, databaseId, queryResults } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      let schema = undefined;
      if (databaseId) {
        const apiKey = await storage.getActiveApiKey();
        if (apiKey) {
          const cloudflare = new CloudflareD1Service(apiKey.accountId, apiKey.cloudflareToken);
          schema = await cloudflare.getDatabaseSchema(databaseId);
        }
      }

      // Get conversation history
      const history = await storage.getChatMessages(databaseId);
      const conversationHistory = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const result = await openAIService.chatWithData(
        message, 
        queryResults, 
        schema, 
        conversationHistory
      );

      // Save user message
      await storage.createChatMessage({
        content: message,
        role: 'user',
        databaseId,
      });

      // Save AI response
      await storage.createChatMessage({
        content: result.response,
        role: 'assistant',
        databaseId,
        generatedQuery: result.suggestedQuery,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process chat message" 
      });
    }
  });

  app.get("/api/chat/messages", async (req, res) => {
    try {
      const { databaseId } = req.query;
      const messages = await storage.getChatMessages(databaseId as string);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch chat messages" 
      });
    }
  });

  app.delete("/api/chat/messages", async (req, res) => {
    try {
      const { databaseId } = req.query;
      await storage.clearChatHistory(databaseId as string);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to clear chat history" 
      });
    }
  });

  // Saved queries
  app.post("/api/saved-queries", async (req, res) => {
    try {
      const data = insertSavedQuerySchema.parse(req.body);
      const savedQuery = await storage.createSavedQuery(data);
      res.json(savedQuery);
    } catch (error) {
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to save query" 
      });
    }
  });

  app.get("/api/saved-queries", async (req, res) => {
    try {
      const { databaseId } = req.query;
      const queries = await storage.getSavedQueries(databaseId as string);
      res.json(queries);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch saved queries" 
      });
    }
  });

  app.delete("/api/saved-queries/:id", async (req, res) => {
    try {
      const success = await storage.deleteSavedQuery(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Saved query not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to delete saved query" 
      });
    }
  });

  // Export functionality
  app.post("/api/export", async (req, res) => {
    try {
      const { data, format, filename } = req.body;
      
      if (format === 'csv') {
        const csv = convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename || 'export.csv'}`);
        res.send(csv);
      } else if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename || 'export.json'}`);
        res.json(data);
      } else {
        res.status(400).json({ message: "Unsupported format" });
      }
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to export data" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma or quote
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}
