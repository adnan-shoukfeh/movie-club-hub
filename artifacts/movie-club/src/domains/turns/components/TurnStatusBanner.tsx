import { FastForward, Rewind } from "lucide-react";
import { formatDateET, formatWeekdayShortDateET } from "@/lib/utils";
import { normalizeWeekOf } from "../turnUtils";
import type { GroupDetail } from "@workspace/api-client-react";

interface TurnStatusBannerProps {
  group: GroupDetail;
  selectedWeek: string;
  onWeekChange: (week: string) => void;
  /** Deadline (ms) of the selected turn; the turn ends the day before it. */
  deadlineMs?: number | null;
  isNavigating?: boolean;
}

export function TurnStatusBanner({
  group,
  selectedWeek,
  onWeekChange,
  deadlineMs,
  isNavigating = false,
}: TurnStatusBannerProps) {
  // deadlineMs is midnight at the end of the turn's last day, so the turn's
  // end date is the day before it.
  const endDateStr = deadlineMs
    ? new Date(deadlineMs - 86400000).toISOString().slice(0, 10)
    : null;
  const currentTurnWeekOf = group.currentTurnWeekOf;

  const selectedNorm = normalizeWeekOf(selectedWeek);
  const currentNorm = normalizeWeekOf(currentTurnWeekOf);

  const isCurrentWeek = selectedNorm === currentNorm;
  const isPastWeek = selectedNorm < currentNorm;

  // Adjacent turns come from the real schedule (backend), so the arrows step
  // through the actual turn dates and match the admin picker schedule.
  const nav = group as GroupDetail & { prevWeekOf?: string; nextWeekOf?: string };
  const prevWeekOf = nav.prevWeekOf || "";
  const nextWeekOf = nav.nextWeekOf || "";

  return (
    <nav
      className="turn-status-banner relative flex items-center justify-center gap-2 sm:gap-3 mb-5 sm:mb-8"
      aria-label="Browse movie club turns"
      aria-busy={isNavigating}
      data-tracking={isNavigating ? "true" : "false"}
    >
      <button
        onClick={() => prevWeekOf && onWeekChange(prevWeekOf)}
        disabled={!prevWeekOf || isNavigating}
        className="turn-status-control shrink-0 p-2 sm:p-3 bg-card border-4 border-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all"
        aria-label="Previous turn"
        title="Rewind to previous movie night"
      >
        <Rewind className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
      </button>

      <div className="turn-status-summary text-center bg-primary px-3 py-1.5 sm:px-6 sm:py-3 border-4 border-secondary">
        <div className="flex items-center justify-center gap-2">
          <span className="turn-status-date text-sm sm:text-base text-secondary font-black leading-none">
            {formatDateET(selectedWeek)}
          </span>
          {isCurrentWeek ? (
            <span className="turn-status-tag px-1.5 py-0.5 bg-secondary text-primary text-[10px] sm:text-xs font-black uppercase tracking-wider">
              Active
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onWeekChange(currentTurnWeekOf)}
              aria-label="Go back to the current movie night"
              className="turn-status-tag turn-status-go-back px-2 py-0.5 bg-secondary text-primary text-[10px] sm:text-xs font-black uppercase tracking-wider inline-flex items-center hover:bg-primary hover:text-secondary transition-all"
            >
              Go Back
            </button>
          )}
        </div>
        {endDateStr && (
          <p className="turn-status-deadline text-[10px] sm:text-[11px] text-secondary/80 font-bold uppercase tracking-wide leading-none mt-1">
            {isPastWeek ? "Ended" : "Ends"} {formatWeekdayShortDateET(endDateStr)}
          </p>
        )}
      </div>

      <button
        onClick={() => nextWeekOf && onWeekChange(nextWeekOf)}
        disabled={!nextWeekOf || isNavigating}
        className="turn-status-control shrink-0 p-2 sm:p-3 bg-card border-4 border-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all"
        aria-label="Next turn"
        title="Fast-forward to next movie night"
      >
        <FastForward className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
      </button>
    </nav>
  );
}
