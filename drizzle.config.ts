import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/blueprint_placeholder";

if (!process.env.DATABASE_URL) {
  console.warn("Warning: DATABASE_URL environment variable is not set. Using placeholder connection string.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
