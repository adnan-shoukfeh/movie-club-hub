import { pgTable, serial, timestamp, integer, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { groupsTable } from "./groups";

export const pickerAssignmentsTable = pgTable("picker_assignments", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  weekOf: text("week_of").notNull(), // ISO date "YYYY-MM-DD" Monday of the week
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("picker_group_week_unique").on(table.groupId, table.weekOf),
]);

export const insertPickerAssignmentSchema = createInsertSchema(pickerAssignmentsTable).omit({ id: true, createdAt: true });
export type InsertPickerAssignment = z.infer<typeof insertPickerAssignmentSchema>;
export type PickerAssignment = typeof pickerAssignmentsTable.$inferSelect;
