import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { groupsTable } from "./groups";
import { usersTable } from "./users";

export const moviesTable = pgTable("movies", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id),
  title: text("title").notNull(),
  weekOf: text("week_of").notNull(),
  setByUserId: integer("set_by_user_id").references(() => usersTable.id),
  imdbId: text("imdb_id"),
  poster: text("poster"),
  director: text("director"),
  genre: text("genre"),
  runtime: text("runtime"),
  year: text("year"),
  nominatorUserId: integer("nominator_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("movies_group_week_unique").on(table.groupId, table.weekOf),
]);

export const insertMovieSchema = createInsertSchema(moviesTable).omit({ id: true, createdAt: true });
export type InsertMovie = z.infer<typeof insertMovieSchema>;
export type Movie = typeof moviesTable.$inferSelect;
