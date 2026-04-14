import { pgTable, serial, timestamp, integer, text, unique, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { groupsTable } from "./groups";

export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  rating: real("rating").notNull(),
  review: text("review"),
  weekOf: text("week_of").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("votes_user_group_week_unique").on(table.userId, table.groupId, table.weekOf),
]);

export const insertVoteSchema = createInsertSchema(votesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votesTable.$inferSelect;
