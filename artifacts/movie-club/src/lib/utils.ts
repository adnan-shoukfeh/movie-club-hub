import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a UTC timestamp (ms) as a human-readable date/time in Eastern Time.
 * Automatically handles EST/EDT transitions.
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
  });
}

/**
 * Format a calendar date string (YYYY-MM-DD) as a full date label.
 * Returns e.g. "Apr 13, 2025". Parsed at noon UTC and formatted in UTC so the
 * displayed day always matches the literal date (no timezone shift).
 */
export function formatDateET(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Format a calendar date string (YYYY-MM-DD) as a short date label (no year).
 * Returns e.g. "Apr 13". Same no-shift convention as formatDateET.
 */
export function formatShortDateET(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
