import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // Don't log response bodies for sensitive endpoints
      if (capturedJsonResponse && !path.includes("/api-keys")) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Add data for testing when in development mode
  if (app.get("env") === "development") {
    const { storage } = await import("./storage");
    
    // Add real Cloudflare credentials if available
    if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
      await storage.createApiKey({
        name: "Real Cloudflare Account",
        cloudflareToken: process.env.CLOUDFLARE_API_TOKEN,
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        isActive: true,
      });
      log("Real Cloudflare credentials configured");
    }
    
    // Also add a mock API key for fallback testing
    await storage.createApiKey({
      name: "Mock Development Key",
      cloudflareToken: "mock-token-for-testing",
      accountId: "mock-account-id",
      isActive: false,
    });

    // Add some mock databases
    await storage.createDatabase({
      id: "db-test-1",
      name: "Users Database",
      accountId: "mock-account-id",
    });

    await storage.createDatabase({
      id: "db-test-2", 
      name: "Analytics Database",
      accountId: "mock-account-id",
    });

    log("Development testing data configured");
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
