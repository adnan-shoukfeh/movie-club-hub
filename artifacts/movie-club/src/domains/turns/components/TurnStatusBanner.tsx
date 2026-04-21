import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateET } from "@/lib/utils";
import { offsetWeekOf, getTurnIndexForDate, getTurnStartDate } from "../turnUtils";
import type { GroupDetail, GroupStatus } from "@workspace/api-client-react";

interface TurnStatusBannerProps {
  group: GroupDetail;
  selectedWeek: string;
  onWeekChange: (week: string) => void;
}

export function TurnStatusBanner({ group, selectedWeek, onWeekChange }: TurnStatusBannerProps) {
  const currentTurnWeekOf = group.currentTurnWeekOf;
  const isCurrentWeek = selectedWeek === currentTurnWeekOf;
  const isPastWeek = selectedWeek < currentTurnWeekOf;
  const isAdminOrOwner = group.myRole === "owner" || group.myRole === "admin";

  const config = group.turnConfig;
  const _currentIdx = getTurnIndexForDate(currentTurnWeekOf, config);
  const nextTurnWeekOf = getTurnStartDate(_currentIdx + 1, config);
  const _maxAllowedWeekOf = getTurnStartDate(_currentIdx + group.members.length, config);
  const isAtFutureCap = selectedWeek >= _maxAllowedWeekOf;

  return (
    <div className="bg-card/30 border border-border/20 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onWeekChange(offsetWeekOf(selectedWeek, -1, config))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {isCurrentWeek ? "This Turn" : isPastWeek ? "Past Turn" : "Future Turn"}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateET(selectedWeek)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onWeekChange(offsetWeekOf(selectedWeek, 1, config))}
          disabled={(!isAdminOrOwner && selectedWeek >= nextTurnWeekOf) || isAtFutureCap}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      {!isCurrentWeek && (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-primary hover:text-primary/80 gap-1.5"
            onClick={() => onWeekChange(currentTurnWeekOf)}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Back to current turn
          </Button>
        </div>
      )}
    </div>
  );
}
