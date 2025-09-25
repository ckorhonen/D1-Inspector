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

    if (!response.ok) {
      throw new Error(`Failed to execute query: ${response.statusText}`);
    }

    const data: CloudflareD1Response = await response.json();
    
    if (!data.success) {
      throw new Error(`Query execution failed: ${data.errors.map(e => e.message).join(', ')}`);
    }

    return {
      results: data.result?.results || [],
      duration: data.result?.duration,
      changes: data.result?.changes,
      count: data.result?.count,
    };
  }

  async getDatabaseSchema(databaseId: string): Promise<any[]> {
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
