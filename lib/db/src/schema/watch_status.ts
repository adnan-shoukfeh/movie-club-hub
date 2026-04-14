import { pgTable, serial, timestamp, integer, text, boolean, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { groupsTable } from "./groups";

export const watchStatusTable = pgTable("watch_status", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  weekOf: text("week_of").notNull(),
  watched: boolean("watched").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("watch_status_user_group_week").on(table.userId, table.groupId, table.weekOf),
]);

export type WatchStatus = typeof watchStatusTable.$inferSelect;
