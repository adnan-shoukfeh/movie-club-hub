import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { groupsTable } from "./groups";

export const membershipsTable = pgTable("memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  role: text("role").notNull().default("member"), // owner, admin, member
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("memberships_user_group_unique").on(table.userId, table.groupId),
]);

export const insertMembershipSchema = createInsertSchema(membershipsTable).omit({ id: true, joinedAt: true });
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Membership = typeof membershipsTable.$inferSelect;
