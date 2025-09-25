import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export class OpenAIService {
  async generateSQLQuery(
    naturalLanguageQuery: string,
    schema: any[],
    databaseContext?: string
  ): Promise<{ query: string; explanation: string }> {
    const schemaContext = schema.map(table => 
      `Table: ${table.name}\nSQL: ${table.sql}`
    ).join('\n\n');

    const prompt = `You are a SQL expert helping with Cloudflare D1 database queries. 

Database Schema:
${schemaContext}

${databaseContext ? `Database Context: ${databaseContext}` : ''}

User Request: "${naturalLanguageQuery}"

Generate a SQL query that answers the user's request. Respond with a JSON object containing:
- "query": the SQL query string
- "explanation": a brief explanation of what the query does

Ensure the query is syntactically correct for SQLite (Cloudflare D1 uses SQLite).`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a SQL expert specializing in SQLite and Cloudflare D1 databases. Always respond with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        query: result.query || '',
        explanation: result.explanation || ''
      };
    } catch (error) {
      throw new Error(`Failed to generate SQL query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chatWithData(
    message: string,
    queryResults?: any[],
    schema?: any[],
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<{ response: string; suggestedQuery?: string }> {
    const systemMessage = `You are an AI database assistant for Cloudflare D1 databases. You help users understand their data, analyze query results, and suggest optimizations.

${schema ? `Database Schema: ${schema.map(t => `${t.name}: ${t.sql}`).join('\n')}` : ''}

${queryResults ? `Current Query Results: ${JSON.stringify(queryResults.slice(0, 5))}${queryResults.length > 5 ? '... (showing first 5 rows)' : ''}` : ''}

Respond with helpful insights, explanations, or suggestions. If you think a SQL query would be helpful, include it in your response.`;

    const messages = [
      { role: "system", content: systemMessage },
      ...(conversationHistory || []),
      { role: "user", content: message }
    ];

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: messages as any[],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        response: result.response || result.content || '',
        suggestedQuery: result.suggestedQuery || result.query
      };
    } catch (error) {
      throw new Error(`Failed to process chat message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async explainQueryResults(
    query: string,
    results: any[],
    schema?: any[]
  ): Promise<string> {
    const prompt = `Analyze this SQL query and its results:

Query: ${query}
Results: ${JSON.stringify(results.slice(0, 10))}${results.length > 10 ? '... (showing first 10 rows)' : ''}
${schema ? `Schema: ${schema.map(t => `${t.name}: ${t.sql}`).join('\n')}` : ''}

Provide a clear explanation of what the query does and what the results show. Include insights about the data patterns or interesting findings.

Respond with JSON: { "explanation": "your explanation here" }`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a data analyst explaining SQL query results in simple terms."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.explanation || 'Unable to generate explanation.';
    } catch (error) {
      throw new Error(`Failed to explain query results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const openAIService = new OpenAIService();
