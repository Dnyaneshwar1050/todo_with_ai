import { timestamp } from "drizzle-orm/gel-core";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { time } from "node:console";

export const todos = pgTable("todos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  todo: text().notNull(),
  relatedAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});
