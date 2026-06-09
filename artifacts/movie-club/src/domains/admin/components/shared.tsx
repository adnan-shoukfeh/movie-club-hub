import { AlertTriangle, Calendar as CalendarIcon2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

export async function apiCall<T = Record<string, unknown>>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, credentials: "include" });
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data as T;
}

export function formatCalendarDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ScheduleEntry {
  weekOf: string;
  pickerUserId: number | null;
  pickerUsername: string | null;
  movie: { id: number; title: string; weekOf: string; poster?: string | null } | null;
  reviewUnlockedByAdmin: boolean;
  movieUnlockedByAdmin: boolean;
  extendedDays: number;
  startOffsetDays: number;
  deadlineMs: number;
}

export interface AdminMember {
  id: number;
  username: string;
}

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  variant = "destructive",
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "destructive" | "warning";
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-5 max-w-sm w-full shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${variant === "destructive" ? "text-destructive" : "text-yellow-400"}`} />
          <p className="text-sm text-foreground leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            variant={variant === "destructive" ? "destructive" : "default"}
            className={variant === "warning" ? "bg-yellow-600 hover:bg-yellow-700 text-white" : ""}
            onClick={onConfirm}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

interface TurnDateRangeInputProps {
  weekOf: string;
  turnLengthDays: number;
  extendedDays: number;
  startOffsetDays: number;
  onDeadlineChange: (extendedDays: number) => void;
}

export function TurnDateRangeInput({
  weekOf,
  turnLengthDays,
  extendedDays,
  startOffsetDays,
  onDeadlineChange,
}: TurnDateRangeInputProps) {
  const [open, setOpen] = useState(false);

  // The start date is derived automatically (the day after the previous turn's
  // deadline), so it is shown read-only here and only the deadline is editable.
  const startDateStr = addDaysToDateStr(weekOf, startOffsetDays);
  const baseDeadlineExclusiveStr = addDaysToDateStr(weekOf, turnLengthDays);
  const deadlineLastDayStr = addDaysToDateStr(weekOf, turnLengthDays + extendedDays - 1);

  const deadlineMinDate = new Date(addDaysToDateStr(startDateStr, 1) + "T00:00:00");
  const baseDeadlineMaxStr = addDaysToDateStr(weekOf, turnLengthDays + 364);
  const deadlineMaxDate = new Date(baseDeadlineMaxStr + "T00:00:00");

  const handleDeadlineSelect = (date: Date | undefined) => {
    if (!date) return;
    const selectedStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const exclusiveStr = addDaysToDateStr(selectedStr, 1);
    const base = new Date(baseDeadlineExclusiveStr + "T00:00:00.000Z");
    const selected = new Date(exclusiveStr + "T00:00:00.000Z");
    onDeadlineChange(Math.round((selected.getTime() - base.getTime()) / 86400000));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex-1 h-7 text-xs rounded-md bg-background border border-border px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex items-center gap-1.5 text-left min-w-0"
        >
          <CalendarIcon2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="truncate">{formatCalendarDate(startDateStr)} → {formatCalendarDate(deadlineLastDayStr)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 overflow-hidden" align="start">
        <div className="px-3 pt-2 pb-1">
          <div className="text-center px-2 py-1.5 rounded-md bg-primary/20 border border-primary/40 text-primary">
            <span className="block text-[10px] uppercase tracking-wide opacity-70">Deadline</span>
            <span className="text-xs font-semibold">{formatCalendarDate(deadlineLastDayStr)}</span>
          </div>
        </div>
        <Calendar
          mode="single"
          selected={new Date(deadlineLastDayStr + "T12:00:00")}
          onSelect={handleDeadlineSelect}
          disabled={(date) => date < deadlineMinDate || date > deadlineMaxDate}
          classNames={{ root: "w-full" }}
        />
      </PopoverContent>
    </Popover>
  );
}
