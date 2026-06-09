import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import { formatDateET, formatShortDateET } from "@/lib/utils";
import { normalizeWeekOf } from "../turnUtils";
import type { GroupDetail } from "@workspace/api-client-react";

interface TurnStatusBannerProps {
  group: GroupDetail;
  selectedWeek: string;
  onWeekChange: (week: string) => void;
  /** Deadline (ms) of the selected turn; the turn ends the day before it. */
  deadlineMs?: number | null;
}

export function TurnStatusBanner({ group, selectedWeek, onWeekChange, deadlineMs }: TurnStatusBannerProps) {
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
    <div className="flex items-center justify-between mb-8">
      <button
        onClick={() => prevWeekOf && onWeekChange(prevWeekOf)}
        disabled={!prevWeekOf}
        className="p-3 bg-card border-4 border-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all"
      >
        <ChevronLeft className="w-6 h-6 text-primary" />
      </button>

      <div className="text-center bg-primary px-6 py-3 border-4 border-secondary">
        <p className="text-sm text-secondary font-bold mb-1">
          {formatDateET(selectedWeek)}
        </p>
        {endDateStr && (
          <p className="text-[11px] text-secondary/80 font-bold uppercase tracking-wide mb-1">
            {isPastWeek ? "Ended" : "Ends"} {formatShortDateET(endDateStr)}
          </p>
        )}
        {isCurrentWeek && (
          <span className="inline-block px-4 py-1 bg-secondary text-primary text-xs font-black uppercase tracking-wider">
            Active Turn
          </span>
        )}
        {isPastWeek && (
          <span className="inline-block px-4 py-1 bg-secondary text-white text-xs font-black uppercase tracking-wider">
            Past Turn
          </span>
        )}
      </div>

      <button
        onClick={() => nextWeekOf && onWeekChange(nextWeekOf)}
        disabled={!nextWeekOf}
        className="p-3 bg-card border-4 border-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all"
      >
        <ChevronRight className="w-6 h-6 text-primary" />
      </button>

      {!isCurrentWeek && (
        <button
          onClick={() => onWeekChange(currentTurnWeekOf)}
          className="absolute left-1/2 -translate-x-1/2 -bottom-6 px-4 py-1.5 bg-secondary border-2 border-primary text-primary text-xs font-bold uppercase flex items-center gap-1.5 hover:bg-primary hover:text-secondary transition-all"
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          Back to current
        </button>
      )}
    </div>
  );
}
