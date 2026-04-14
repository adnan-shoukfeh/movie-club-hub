import { pgTable, serial, timestamp, integer, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { groupsTable } from "./groups";

export const nominationsTable = pgTable("nominations", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  imdbId: text("imdb_id").notNull(),
  title: text("title").notNull(),
  year: text("year"),
  poster: text("poster"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("nominations_group_imdb_unique").on(table.groupId, table.imdbId),
]);

export const insertNominationSchema = createInsertSchema(nominationsTable).omit({ id: true, createdAt: true });
export type InsertNomination = z.infer<typeof insertNominationSchema>;
export type Nomination = typeof nominationsTable.$inferSelect;
