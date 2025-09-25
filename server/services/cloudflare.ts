interface CloudflareD1Response {
  success: boolean;
  errors: any[];
  messages: any[];
  result?: {
    results?: any[];
    duration?: number;
    changes?: number;
    last_row_id?: number;
    served_by?: string;
    count?: number;
  };
}

// Custom error classes to distinguish error types
export class CloudflareUserError extends Error {
  constructor(message: string, public originalErrors: any[] = []) {
    super(message);
    this.name = 'CloudflareUserError';
  }
}

export class CloudflareSystemError extends Error {
  constructor(message: string, public statusCode?: number, public originalErrors: any[] = []) {
    super(message);
    this.name = 'CloudflareSystemError';
  }
}

interface CloudflareDatabaseListResponse {
  success: boolean;
  errors: any[];
  messages: any[];
  result?: Array<{
    uuid: string;
    name: string;
    created_at: string;
    version: string;
    running_in_region: string;
  }>;
}

export class CloudflareD1Service {
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(
    private accountId: string,
    private apiToken: string
  ) {}

  async listDatabases(): Promise<any[]> {
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/d1/database`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list databases: ${response.statusText}`);
    }

    const data: CloudflareDatabaseListResponse = await response.json();
    
    if (!data.success) {
      throw new Error(`Cloudflare API error: ${data.errors.map(e => e.message).join(', ')}`);
    }

    return data.result || [];
  }

  async executeQuery(databaseId: string, query: string): Promise<{
    results: any[];
    duration?: number;
    changes?: number;
    count?: number;
  }> {
    const response = await fetch(
      `${this.baseUrl}/accounts/${this.accountId}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: query,
        }),
      }
    );

    // Handle HTTP errors (auth, network, etc.) as system errors
    if (!response.ok) {
      const statusCode = response.status;
      const statusText = response.statusText;
      
      // Authentication/authorization errors are system errors
      if (statusCode === 401 || statusCode === 403) {
        throw new CloudflareSystemError(`Authentication failed: ${statusText}`, statusCode);
      }
      
      // Other HTTP errors are also system errors
      throw new CloudflareSystemError(`HTTP error ${statusCode}: ${statusText}`, statusCode);
    }

    const data: CloudflareD1Response = await response.json();
    
    if (!data.success) {
      const errorMessages = data.errors.map(e => e.message).join(', ');
      
      // Check if this is a SQL syntax or query error (user error)
      const isSQLError = data.errors.some(error => {
        const msg = error.message?.toLowerCase() || '';
        return msg.includes('syntax error') ||
               msg.includes('no such table') ||
               msg.includes('no such column') ||
               msg.includes('near ') ||
               msg.includes('sql error') ||
               msg.includes('parse error') ||
               msg.includes('duplicate column') ||
               msg.includes('table') && msg.includes('already exists') ||
               msg.includes('constraint');
      });
      
      if (isSQLError) {
        throw new CloudflareUserError(errorMessages, data.errors);
      } else {
        // Other errors (rate limits, service unavailable, etc.) are system errors
        throw new CloudflareSystemError(errorMessages, undefined, data.errors);
      }
    }

    return {
      results: data.result?.results || [],
      duration: data.result?.duration,
      changes: data.result?.changes,
      count: data.result?.count,
    };
  }

  async getDatabaseSchema(databaseId: string): Promise<any[]> {
    // In development mode with mock credentials, return mock schema
    if (process.env.NODE_ENV === "development" && this.apiToken === "mock-token-for-testing") {
      if (databaseId === "db-test-1") {
        return [
          {
            name: "users",
            type: "table",
            sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, created_at TEXT, status TEXT)"
          }
        ];
      } else if (databaseId === "db-test-2") {
        return [
          {
            name: "analytics",
            type: "table", 
            sql: "CREATE TABLE analytics (date TEXT, page_views INTEGER, unique_visitors INTEGER, bounce_rate REAL)"
          }
        ];
      }
      return [];
    }

    const schemaQuery = `
      SELECT 
        name, 
        type, 
        sql 
      FROM sqlite_master 
      WHERE type IN ('table', 'view') 
      ORDER BY name;
    `;

    const result = await this.executeQuery(databaseId, schemaQuery);
    return result.results;
  }

  async getTableInfo(databaseId: string, tableName: string): Promise<any[]> {
    const tableInfoQuery = `PRAGMA table_info(${tableName});`;
    const result = await this.executeQuery(databaseId, tableInfoQuery);
    return result.results;
  }
}
