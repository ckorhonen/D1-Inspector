import { 
  type ApiKey, 
  type InsertApiKey,
  type Database,
  type InsertDatabase,
  type SavedQuery,
  type InsertSavedQuery,
  type ChatMessage,
  type InsertChatMessage,
  type QueryResult,
  type InsertQueryResult
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // API Keys
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeys(): Promise<ApiKey[]>;
  getActiveApiKey(): Promise<ApiKey | undefined>;
  updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined>;
  deleteApiKey(id: string): Promise<boolean>;

  // Databases
  createDatabase(database: InsertDatabase): Promise<Database>;
  getDatabases(): Promise<Database[]>;
  getDatabase(id: string): Promise<Database | undefined>;
  updateDatabase(id: string, updates: Partial<Database>): Promise<Database | undefined>;

  // Saved Queries
  createSavedQuery(query: InsertSavedQuery): Promise<SavedQuery>;
  getSavedQueries(databaseId?: string): Promise<SavedQuery[]>;
  getSavedQuery(id: string): Promise<SavedQuery | undefined>;
  updateSavedQuery(id: string, updates: Partial<SavedQuery>): Promise<SavedQuery | undefined>;
  deleteSavedQuery(id: string): Promise<boolean>;

  // Chat Messages
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(databaseId?: string): Promise<ChatMessage[]>;
  clearChatHistory(databaseId?: string): Promise<boolean>;

  // Query Results (for caching)
  createQueryResult(result: InsertQueryResult): Promise<QueryResult>;
  getQueryResult(queryHash: string, databaseId: string): Promise<QueryResult | undefined>;
}

export class MemStorage implements IStorage {
  private apiKeys: Map<string, ApiKey> = new Map();
  private databases: Map<string, Database> = new Map();
  private savedQueries: Map<string, SavedQuery> = new Map();
  private chatMessages: Map<string, ChatMessage> = new Map();
  private queryResults: Map<string, QueryResult> = new Map();

  // API Keys
  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const id = randomUUID();
    const apiKey: ApiKey = { 
      ...insertApiKey, 
      id, 
      createdAt: new Date(),
      isActive: true
    };
    this.apiKeys.set(id, apiKey);
    return apiKey;
  }

  async getApiKeys(): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values());
  }

  async getActiveApiKey(): Promise<ApiKey | undefined> {
    return Array.from(this.apiKeys.values()).find(key => key.isActive);
  }

  async updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | undefined> {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) return undefined;
    
    const updated = { ...apiKey, ...updates };
    this.apiKeys.set(id, updated);
    return updated;
  }

  async deleteApiKey(id: string): Promise<boolean> {
    return this.apiKeys.delete(id);
  }

  // Databases
  async createDatabase(insertDatabase: InsertDatabase): Promise<Database> {
    const database: Database = { 
      ...insertDatabase, 
      createdAt: new Date(),
      isActive: true
    };
    this.databases.set(database.id, database);
    return database;
  }

  async getDatabases(): Promise<Database[]> {
    return Array.from(this.databases.values()).filter(db => db.isActive);
  }

  async getDatabase(id: string): Promise<Database | undefined> {
    return this.databases.get(id);
  }

  async updateDatabase(id: string, updates: Partial<Database>): Promise<Database | undefined> {
    const database = this.databases.get(id);
    if (!database) return undefined;
    
    const updated = { ...database, ...updates };
    this.databases.set(id, updated);
    return updated;
  }

  // Saved Queries
  async createSavedQuery(insertQuery: InsertSavedQuery): Promise<SavedQuery> {
    const id = randomUUID();
    const savedQuery: SavedQuery = { 
      ...insertQuery,
      description: insertQuery.description ?? null,
      id, 
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.savedQueries.set(id, savedQuery);
    return savedQuery;
  }

  async getSavedQueries(databaseId?: string): Promise<SavedQuery[]> {
    const queries = Array.from(this.savedQueries.values());
    return databaseId ? queries.filter(q => q.databaseId === databaseId) : queries;
  }

  async getSavedQuery(id: string): Promise<SavedQuery | undefined> {
    return this.savedQueries.get(id);
  }

  async updateSavedQuery(id: string, updates: Partial<SavedQuery>): Promise<SavedQuery | undefined> {
    const query = this.savedQueries.get(id);
    if (!query) return undefined;
    
    const updated = { ...query, ...updates, updatedAt: new Date() };
    this.savedQueries.set(id, updated);
    return updated;
  }

  async deleteSavedQuery(id: string): Promise<boolean> {
    return this.savedQueries.delete(id);
  }

  // Chat Messages
  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const chatMessage: ChatMessage = { 
      ...insertMessage,
      databaseId: insertMessage.databaseId ?? null,
      generatedQuery: insertMessage.generatedQuery ?? null,
      id, 
      createdAt: new Date()
    };
    this.chatMessages.set(id, chatMessage);
    return chatMessage;
  }

  async getChatMessages(databaseId?: string): Promise<ChatMessage[]> {
    const messages = Array.from(this.chatMessages.values());
    const filtered = databaseId ? messages.filter(m => m.databaseId === databaseId) : messages;
    return filtered.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  }

  async clearChatHistory(databaseId?: string): Promise<boolean> {
    if (databaseId) {
      const messages = Array.from(this.chatMessages.entries());
      for (const [id, message] of messages) {
        if (message.databaseId === databaseId) {
          this.chatMessages.delete(id);
        }
      }
    } else {
      this.chatMessages.clear();
    }
    return true;
  }

  // Query Results
  async createQueryResult(insertResult: InsertQueryResult): Promise<QueryResult> {
    const id = randomUUID();
    const queryResult: QueryResult = { 
      ...insertResult,
      executionTime: insertResult.executionTime ?? null,
      rowCount: insertResult.rowCount ?? null,
      id, 
      createdAt: new Date()
    };
    this.queryResults.set(id, queryResult);
    return queryResult;
  }

  async getQueryResult(queryHash: string, databaseId: string): Promise<QueryResult | undefined> {
    return Array.from(this.queryResults.values()).find(
      r => r.queryHash === queryHash && r.databaseId === databaseId
    );
  }
}

export const storage = new MemStorage();
