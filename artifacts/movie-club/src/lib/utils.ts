import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a UTC timestamp (ms) as a human-readable date/time in Eastern Time (ET).
 * Automatically handles EST/EDT transitions.
 * Appends " ET" to the formatted string.
 */
export function formatDeadlineET(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }) + " ET";
}

/**
 * Format a date string (YYYY-MM-DD) as a full date label in Eastern Time.
 * Returns e.g. "Apr 13, 2025 ET"
 */
export function formatDateET(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }) + " ET";
}

/**
 * Format a date string (YYYY-MM-DD) as a short date label (no year) in Eastern Time.
 * Returns e.g. "Apr 13 ET"
 */
export function formatShortDateET(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }) + " ET";
}
