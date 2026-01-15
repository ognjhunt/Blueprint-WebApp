import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@db/schema";

const databaseUrl = process.env.DATABASE_URL || "postgresql://user:password@localhost:5432/blueprint_placeholder";

if (!process.env.DATABASE_URL) {
  console.warn("Warning: DATABASE_URL environment variable is not set. Using placeholder connection string.");
}

export const db = drizzle({
  connection: databaseUrl,
  schema,
  ws: ws,
});
