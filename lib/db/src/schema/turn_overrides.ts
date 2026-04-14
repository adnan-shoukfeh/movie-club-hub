import { pgTable, serial, timestamp, integer, text, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { groupsTable } from "./groups";

export const turnOverridesTable = pgTable("turn_overrides", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  weekOf: text("week_of").notNull(),
  reviewUnlockedByAdmin: boolean("review_unlocked_by_admin").notNull().default(false),
  movieUnlockedByAdmin: boolean("movie_unlocked_by_admin").notNull().default(false),
  extendedDays: integer("extended_days").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("turn_overrides_group_week_unique").on(table.groupId, table.weekOf),
]);

export const insertTurnOverrideSchema = createInsertSchema(turnOverridesTable).omit({ id: true, updatedAt: true });
export type InsertTurnOverride = z.infer<typeof insertTurnOverrideSchema>;
export type TurnOverride = typeof turnOverridesTable.$inferSelect;
