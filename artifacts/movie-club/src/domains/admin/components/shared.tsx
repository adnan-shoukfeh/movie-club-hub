import { AlertTriangle, Calendar as CalendarIcon2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
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
          <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${variant === "destructive" ? "text-destructive" : "text-yellow-400"}`} />
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
  const isMobile = useIsMobile();

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

  const triggerButton = (
    <button
      type="button"
      className="flex-1 h-7 text-xs rounded-md bg-background border border-border px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex items-center gap-1.5 text-left min-w-0"
    >
      <CalendarIcon2 className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="truncate">{formatCalendarDate(startDateStr)} → {formatCalendarDate(deadlineLastDayStr)}</span>
    </button>
  );

  const deadlineHeader = (
    <div className="text-center px-2 py-1 rounded-md bg-primary/20 border border-primary/40 text-primary text-xs font-semibold">
      <span className="uppercase tracking-wide opacity-70">Deadline</span>
      {" · "}
      {formatCalendarDate(deadlineLastDayStr)}
    </div>
  );

  const calendar = (
    <Calendar
      mode="single"
      className="p-1"
      selected={new Date(deadlineLastDayStr + "T12:00:00")}
      onSelect={handleDeadlineSelect}
      disabled={(date) => date < deadlineMinDate || date > deadlineMaxDate}
      classNames={{
        root: "w-full",
        month: "flex w-full flex-col gap-1",
        week: "mt-0.5 flex w-full",
        // Give day cells a fixed height instead of aspect-square. aspect-square
        // derives height from width, which the surrounding table/flex layout
        // resolves too late, causing ancestors to under-measure the calendar's
        // height (rows then overflow the dialog box). A fixed height is
        // deterministic so the popup wraps the whole month correctly.
        day: "group/day relative flex-1 [&_button]:aspect-auto [&_button]:h-9 [&_button]:w-full [&_button]:min-w-0",
        // Days that belong to the previous/next month (shown to fill out the
        // grid) are dimmed so only the current month reads as active.
        outside: "[&_button]:text-muted-foreground/40",
      }}
    />
  );

  // On mobile, anchoring the calendar below the field leaves too little room and
  // forces scrolling. A centered dialog has the full screen height available, so
  // the whole month is always visible without scrolling and clear of the toolbar.
  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
        <DialogContent className="block w-[calc(100vw-2rem)] max-w-[20rem] space-y-2 p-3 pt-9">
          <DialogTitle className="sr-only">Set turn deadline</DialogTitle>
          {deadlineHeader}
          {calendar}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        className="p-0 flex max-h-(--radix-popover-content-available-height) flex-col overflow-hidden"
        align="start"
        collisionPadding={8}
      >
        <div className="px-2 pt-2 shrink-0">{deadlineHeader}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">{calendar}</div>
      </PopoverContent>
    </Popover>
  );
}
