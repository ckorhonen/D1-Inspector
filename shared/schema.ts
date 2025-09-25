import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cloudflareToken: text("cloudflare_token").notNull(),
  accountId: text("account_id").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const databases = pgTable("databases", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  accountId: text("account_id").notNull(),
  createdAt: timestamp("created_at"),
  isActive: boolean("is_active").default(true),
});

export const savedQueries = pgTable("saved_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  sqlQuery: text("sql_query").notNull(),
  databaseId: text("database_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  databaseId: text("database_id"),
  generatedQuery: text("generated_query"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const queryResults = pgTable("query_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queryHash: text("query_hash").notNull(),
  databaseId: text("database_id").notNull(),
  results: jsonb("results").notNull(),
  executionTime: text("execution_time"),
  rowCount: text("row_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
});

export const insertDatabaseSchema = createInsertSchema(databases).omit({
  createdAt: true,
});

export const insertSavedQuerySchema = createInsertSchema(savedQueries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertQueryResultSchema = createInsertSchema(queryResults).omit({
  id: true,
  createdAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

export type InsertDatabase = z.infer<typeof insertDatabaseSchema>;
export type Database = typeof databases.$inferSelect;

export type InsertSavedQuery = z.infer<typeof insertSavedQuerySchema>;
export type SavedQuery = typeof savedQueries.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertQueryResult = z.infer<typeof insertQueryResultSchema>;
export type QueryResult = typeof queryResults.$inferSelect;
