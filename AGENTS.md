# D1 Inspector Agent Instructions

This project is an Express/Vite TypeScript application with Drizzle-backed persistence. Read `package.json`, the affected `server/` or `client/` module, and the schema before changing behavior. Keep server contracts and client query handling aligned.

Install dependencies with the committed lockfile when one is added; this checkout currently has no project lockfile, so do not invent a package-manager pin. For code changes, use `npm run check` and `npm run build`; start `npm run dev` only when a local interaction check is needed. `npm run db:push` changes the configured database, so report its migration scope and readback separately from local checks.

Do not commit database URLs, session secrets, OpenAI credentials, or production data. Preserve unrelated checkout changes and complete authorized work through proportionate validation; pause for a material unresolved schema, data-retention, or production decision.
