# Overview

This is a full-stack TypeScript application called "D1 Query Studio" - a database analytics and query management tool specifically designed for Cloudflare D1 databases. The application provides a web-based interface for managing database connections, executing SQL queries, visualizing data, and interacting with an AI assistant for natural language to SQL query generation.

The system consists of a React frontend with shadcn/ui components, an Express.js backend, and integrates with Cloudflare's D1 database service and OpenAI's API for intelligent query assistance.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints for resource management
- **Request Handling**: JSON middleware with URL encoding support
- **Error Handling**: Centralized error middleware with status code management

## Data Storage Solutions
- **ORM**: Drizzle ORM with PostgreSQL dialect for local data persistence
- **Database**: PostgreSQL (via Neon serverless driver) for application data
- **Schema Management**: Drizzle Kit for migrations and schema generation
- **In-Memory Storage**: Fallback memory storage implementation for development

## Key Data Models
- **API Keys**: Cloudflare authentication credentials with account mapping
- **Databases**: Cloudflare D1 database registry and metadata
- **Saved Queries**: User-defined SQL queries with descriptions and timestamps
- **Chat Messages**: AI conversation history for query assistance
- **Query Results**: Cached query execution results with performance metrics

## Authentication and Authorization
- **Cloudflare Integration**: API token-based authentication for D1 service access
- **Session Management**: Connect-pg-simple for PostgreSQL session storage
- **API Key Management**: Active/inactive key states with validation testing

## External Dependencies

### Core Services
- **Cloudflare D1**: Primary database service for query execution and schema management
- **OpenAI API**: GPT-5 model integration for natural language to SQL conversion
- **Neon Database**: Serverless PostgreSQL for application data persistence

### Development Tools
- **Replit Integration**: Development environment support with cartographer and dev banner plugins
- **Vite Plugins**: Runtime error overlay and development tooling

### UI and Visualization
- **Recharts**: Data visualization library for charts and graphs
- **Data Export**: CSV and JSON export functionality for query results
- **Responsive Design**: Mobile-first approach with breakpoint-based layouts

### Query and AI Features
- **SQL Generation**: Context-aware query generation using database schema
- **Query Caching**: Hash-based result caching for performance optimization
- **Natural Language Processing**: User intent interpretation for database operations
- **Real-time Chat**: Interactive AI assistant for query building and optimization

## Performance Considerations
- **Query Pagination**: Client-side pagination for large result sets
- **Data Visualization**: Limited data rendering (first 20 rows for charts, top 8 for pie charts)
- **Caching Strategy**: Query result caching based on SQL hash and database context
- **Memory Management**: In-memory storage fallback for development environments