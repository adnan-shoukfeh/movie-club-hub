import { pgTable, text, serial, timestamp, integer, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startDate: date("start_date").notNull().defaultNow(),
  turnLengthDays: integer("turn_length_days").notNull().default(7),
});

export const turnExtensionsTable = pgTable("turn_extensions", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  turnIndex: integer("turn_index").notNull(),
  extraDays: integer("extra_days").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("turn_extensions_group_turn_unique").on(table.groupId, table.turnIndex),
]);

export const insertGroupSchema = createInsertSchema(groupsTable).omit({ id: true, createdAt: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groupsTable.$inferSelect;

export const insertTurnExtensionSchema = createInsertSchema(turnExtensionsTable).omit({ id: true, createdAt: true });
export type InsertTurnExtension = z.infer<typeof insertTurnExtensionSchema>;
export type TurnExtension = typeof turnExtensionsTable.$inferSelect;
