import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import { formatDateET } from "@/lib/utils";
import { offsetWeekOf, getTurnIndexForDate, getTurnStartDate, normalizeWeekOf } from "../turnUtils";
import type { GroupDetail } from "@workspace/api-client-react";

interface TurnStatusBannerProps {
  group: GroupDetail;
  selectedWeek: string;
  onWeekChange: (week: string) => void;
}

export function TurnStatusBanner({ group, selectedWeek, onWeekChange }: TurnStatusBannerProps) {
  const currentTurnWeekOf = group.currentTurnWeekOf;

  const selectedNorm = normalizeWeekOf(selectedWeek);
  const currentNorm = normalizeWeekOf(currentTurnWeekOf);

  const isCurrentWeek = selectedNorm === currentNorm;
  const isPastWeek = selectedNorm < currentNorm;
  const isAdminOrOwner = group.myRole === "owner" || group.myRole === "admin";

  const config = group.turnConfig;
  const selectedIdx = getTurnIndexForDate(selectedWeek, config);
  const _currentIdx = getTurnIndexForDate(currentTurnWeekOf, config);
  const nextTurnWeekOf = getTurnStartDate(_currentIdx + 1, config);
  const _maxAllowedWeekOf = getTurnStartDate(_currentIdx + group.members.length, config);
  const isAtFutureCap = normalizeWeekOf(selectedWeek) >= normalizeWeekOf(_maxAllowedWeekOf);
  const isAtTurn0 = selectedIdx === 0;

  return (
    <div className="flex items-center justify-between mb-8">
      <button
        onClick={() => onWeekChange(offsetWeekOf(selectedWeek, -1, config))}
        disabled={isAtTurn0}
        className="p-3 bg-card border-4 border-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all"
      >
        <ChevronLeft className="w-6 h-6 text-primary" />
      </button>

      <div className="text-center bg-primary px-6 py-3 border-4 border-secondary">
        <p className="text-sm text-secondary font-bold mb-1">
          {formatDateET(selectedWeek)}
        </p>
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
        {!isCurrentWeek && !isPastWeek && (
          <span className="inline-block px-4 py-1 bg-secondary text-white/70 text-xs font-black uppercase tracking-wider">
            Future Turn
          </span>
        )}
      </div>

      <button
        onClick={() => onWeekChange(offsetWeekOf(selectedWeek, 1, config))}
        disabled={(!isAdminOrOwner && normalizeWeekOf(selectedWeek) >= normalizeWeekOf(nextTurnWeekOf)) || isAtFutureCap}
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
