import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetGroup,
  getGetGroupQueryKey,
  getGetGroupStatusQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  Shield,
  Calendar as CalendarIcon2,
  Clock,
  Film,
  Users,
  Star,
  Unlock,
  Lock,
  Trash2,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Check,
  X,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { formatDeadlineET, formatDateET } from "@/lib/utils";


function formatWeekLabel(weekOf: string): string {
  return formatDateET(weekOf);
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Display a YYYY-MM-DD calendar date without timezone conversion (avoids UTC→ET day shift).
function formatCalendarDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

interface TurnDateRangeInputProps {
  weekOf: string;
  turnLengthDays: number;
  extendedDays: number;
  startOffsetDays: number;
  prevDeadlineMs: number | null;
  nextTurnDeadlineMs: number | null;
  onStartChange: (offsetDays: number) => void;
  onDeadlineChange: (extendedDays: number) => void;
}

function TurnDateRangeInput({ weekOf, turnLengthDays, extendedDays, startOffsetDays, prevDeadlineMs, nextTurnDeadlineMs, onStartChange, onDeadlineChange }: TurnDateRangeInputProps) {
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<"start" | "deadline">("start");

  const startDateStr = addDaysToDateStr(weekOf, startOffsetDays);
  const baseDeadlineExclusiveStr = addDaysToDateStr(weekOf, turnLengthDays);
  const deadlineLastDayStr = addDaysToDateStr(weekOf, turnLengthDays + extendedDays - 1); // inclusive last day

  const startMinDate = prevDeadlineMs
    ? new Date(new Date(prevDeadlineMs).toISOString().slice(0, 10) + "T00:00:00")
    : new Date(weekOf + "T00:00:00");
  const startMaxDate = new Date(deadlineLastDayStr + "T00:00:00");
  // Deadline must be strictly after start; use start+1 as the minimum selectable deadline day.
  const deadlineMinDate = new Date(addDaysToDateStr(startDateStr, 1) + "T00:00:00");
  // Cap deadline so the next turn still has at least 1 day after the cascade adjusts its start.
  // nextTurnDeadlineMs is ET midnight (exclusive) of the next turn's deadline.
  // Max inclusive last day for this turn = nextTurnDeadline - 2 days.
  const baseDeadlineMaxStr = addDaysToDateStr(weekOf, turnLengthDays + 364);
  const nextTurnDeadlineDateStr = nextTurnDeadlineMs
    ? new Date(nextTurnDeadlineMs).toISOString().slice(0, 10)
    : null;
  const nextTurnCapStr = nextTurnDeadlineDateStr ? addDaysToDateStr(nextTurnDeadlineDateStr, -2) : null;
  const deadlineMaxStr = nextTurnCapStr && nextTurnCapStr < baseDeadlineMaxStr ? nextTurnCapStr : baseDeadlineMaxStr;
  const deadlineMaxDate = new Date(deadlineMaxStr + "T00:00:00");

  const handleStartSelect = (date: Date | undefined) => {
    if (!date) return;
    const selectedStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const base = new Date(weekOf + "T00:00:00.000Z");
    const selected = new Date(selectedStr + "T00:00:00.000Z");
    onStartChange(Math.round((selected.getTime() - base.getTime()) / 86400000));
    setActiveField("deadline");
  };

  const handleDeadlineSelect = (date: Date | undefined) => {
    if (!date) return;
    const selectedStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    // User picked the inclusive last day; exclusive deadline is one day later.
    const exclusiveStr = addDaysToDateStr(selectedStr, 1);
    const base = new Date(baseDeadlineExclusiveStr + "T00:00:00.000Z");
    const selected = new Date(exclusiveStr + "T00:00:00.000Z");
    onDeadlineChange(Math.round((selected.getTime() - base.getTime()) / 86400000));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setActiveField("start"); }}>
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
        <div className="flex gap-1.5 px-3 pt-2 pb-1">
          <button
            type="button"
            onClick={() => setActiveField("start")}
            className={`flex-1 text-center px-2 py-1.5 rounded-md transition-colors ${
              activeField === "start"
                ? "bg-primary/20 border border-primary/40 text-primary"
                : "bg-muted/30 border border-border/40 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <span className="block text-[10px] uppercase tracking-wide opacity-70">Start</span>
            <span className="text-xs font-semibold">{formatCalendarDate(startDateStr)}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveField("deadline")}
            className={`flex-1 text-center px-2 py-1.5 rounded-md transition-colors ${
              activeField === "deadline"
                ? "bg-primary/20 border border-primary/40 text-primary"
                : "bg-muted/30 border border-border/40 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <span className="block text-[10px] uppercase tracking-wide opacity-70">Deadline</span>
            <span className="text-xs font-semibold">{formatCalendarDate(deadlineLastDayStr)}</span>
          </button>
        </div>
        {activeField === "start" ? (
          <Calendar
            mode="single"
            selected={new Date(startDateStr + "T12:00:00")}
            onSelect={handleStartSelect}
            disabled={(date) => date < startMinDate || date > startMaxDate}
            classNames={{ root: "w-full" }}
          />
        ) : (
          <Calendar
            mode="single"
            selected={new Date(deadlineLastDayStr + "T12:00:00")}
            onSelect={handleDeadlineSelect}
            disabled={(date) => date < deadlineMinDate || date > deadlineMaxDate}
            classNames={{ root: "w-full" }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

interface ScheduleEntry {
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

interface VoteEntry {
  userId: number;
  username: string;
  rating: number;
  review: string | null;
}

interface Member {
  id: number;
  username: string;
}

async function apiCall<T = Record<string, unknown>>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, credentials: "include" });
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data as T;
}

function ConfirmDialog({
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

export default function GroupAdmin() {
  const params = useParams<{ groupId: string }>();
  const groupId = parseInt(params.groupId ?? "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: group, isLoading } = useGetGroup(
    groupId,
    {},
    { query: { queryKey: getGetGroupQueryKey(groupId), enabled: !!groupId } }
  );

  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [currentTurnWeekOf, setCurrentTurnWeekOf] = useState<string>("");
  const [scheduleCenterWeekOf, setScheduleCenterWeekOf] = useState<string | undefined>(undefined);

  const [activeSection, setActiveSection] = useState<string | null>("schedule");
  const [confirm, setConfirm] = useState<{ message: string; action: () => void; variant?: "destructive" | "warning" } | null>(null);

  const [votesWeek, setVotesWeek] = useState("");
  const [votes, setVotes] = useState<VoteEntry[]>([]);
  const [votesLoading, setVotesLoading] = useState(false);
  const [editingVote, setEditingVote] = useState<{ userId: number; rating: string; review: string } | null>(null);

  const [extendDaysInput, setExtendDaysInput] = useState<{ [weekOf: string]: string }>({});
  const [startOffsetInput, setStartOffsetInput] = useState<{ [weekOf: string]: number }>({});
  const [pickerWeekEdit, setPickerWeekEdit] = useState<string | null>(null);
  const [pendingPickerMap, setPendingPickerMap] = useState<Record<string, string>>({});
  const [expandedNominationsWeek, setExpandedNominationsWeek] = useState<string | null>(null);
  const [nominationsCache, setNominationsCache] = useState<{ [weekOf: string]: { id: number; title: string; nominatorUsername?: string }[] }>({});
  const [nominationsLoading, setNominationsLoading] = useState(false);

  // Group Settings state
  const [settingsStartDate, setSettingsStartDate] = useState<string>("");
  const [settingsTurnLength, setSettingsTurnLength] = useState<string>("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsDateOpen, setSettingsDateOpen] = useState(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetGroupStatusQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  }, [queryClient, groupId]);

  const loadSchedule = useCallback(async (centerWeekOf?: string) => {
    if (!groupId) return;
    setScheduleLoading(true);
    try {
      const url = centerWeekOf
        ? `/api/admin/groups/${groupId}/schedule?centerWeekOf=${encodeURIComponent(centerWeekOf)}`
        : `/api/admin/groups/${groupId}/schedule`;
      const data = await apiCall<{ schedule: ScheduleEntry[]; members: Member[]; currentTurnWeekOf?: string; centerWeekOf?: string }>( url);
      setSchedule(data.schedule ?? []);
      setMembers(data.members ?? []);
      if (data.currentTurnWeekOf) setCurrentTurnWeekOf(data.currentTurnWeekOf);
      if (data.centerWeekOf) setScheduleCenterWeekOf(data.centerWeekOf);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    } finally {
      setScheduleLoading(false);
    }
  }, [groupId, toast]);

  const loadNominations = useCallback(async () => {
    if (!groupId) return;
    setNominationsLoading(true);
    try {
      const data = await apiCall<Array<{ id: number; title: string; nominatorUsername?: string | null }>>(`/api/groups/${groupId}/nominations`);
      const noms = data.map((n) => ({ id: n.id, title: n.title, nominatorUsername: n.nominatorUsername ?? undefined }));
      setNominationsCache((prev) => ({ ...prev, pool: noms }));
    } catch (e: unknown) {
      toast({ title: "Error loading nominations", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    } finally {
      setNominationsLoading(false);
    }
  }, [groupId, toast]);

  const loadVotes = useCallback(async (weekOf: string) => {
    if (!groupId) return;
    setVotesLoading(true);
    try {
      const data = await apiCall<{ weekOf: string; votes: VoteEntry[] }>(`/api/admin/groups/${groupId}/votes?weekOf=${weekOf}`);
      setVotes(data.votes ?? []);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    } finally {
      setVotesLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    if (groupId) loadSchedule();
  }, [groupId, loadSchedule]);

  useEffect(() => {
    if (currentTurnWeekOf && votesWeek === "") {
      setVotesWeek(currentTurnWeekOf);
    }
  }, [currentTurnWeekOf, votesWeek]);

  useEffect(() => {
    if (activeSection === "votes" && votesWeek) loadVotes(votesWeek);
  }, [activeSection, votesWeek, loadVotes]);

  useEffect(() => {
    if (group && group.myRole !== "owner" && group.myRole !== "admin") {
      setLocation(`/groups/${groupId}`);
    }
  }, [group, groupId, setLocation]);

  useEffect(() => {
    if (group) {
      setSettingsStartDate(group.startDate ?? "");
      setSettingsTurnLength(String(group.turnLengthDays ?? 7));
    }
  }, [group]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Group not found</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/dashboard")}>Back</Button>
        </div>
      </div>
    );
  }

  const isOwner = group.myRole === "owner";
  const isAdminOrOwner = group.myRole === "owner" || group.myRole === "admin";

  if (!isAdminOrOwner) return null;

  const withConfirm = (message: string, action: () => void, variant: "destructive" | "warning" = "destructive") => {
    setConfirm({ message, action, variant });
  };

  const doAction = async (action: () => Promise<void>) => {
    try {
      await action();
      loadSchedule(scheduleCenterWeekOf);
      invalidate();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    }
  };

  const handleAssignPicker = async (weekOf: string, userId: number | null) => {
    await doAction(async () => {
      await apiCall(`/api/admin/groups/${groupId}/picker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, weekOf }),
      });
      toast({ title: userId ? "Picker assigned" : "Picker cleared" });
      setPickerWeekEdit(null);
    });
  };

  const handleSetTurnDates = async (weekOf: string) => {
    const entry = scheduleWeeks.find((e) => e.weekOf === weekOf);
    const startOffset = startOffsetInput[weekOf] ?? entry?.startOffsetDays ?? 0;
    const extDays = parseInt(String(extendDaysInput[weekOf] ?? entry?.extendedDays ?? 0), 10);
    withConfirm(
      `Update start and deadline for turn starting ${formatWeekLabel(weekOf)}? This adjusts when the turn opens and when rating closes.`,
      async () => {
        await doAction(async () => {
          await apiCall(`/api/admin/groups/${groupId}/turn-start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ weekOf, startOffsetDays: startOffset }),
          });
          await apiCall(`/api/admin/groups/${groupId}/extend-turn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ weekOf, extendedDays: extDays }),
          });
          toast({ title: "Turn dates updated" });
        });
      },
      "warning"
    );
  };

  const handleUnlockMovie = async (weekOf: string, unlocked: boolean) => {
    if (unlocked) {
      withConfirm(
        `Unlock movie selection for turn starting ${formatWeekLabel(weekOf)}? Only the assigned picker will be able to change it.`,
        async () => {
          await doAction(async () => {
            await apiCall(`/api/admin/groups/${groupId}/unlock-movie`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ weekOf, unlocked: true }),
            });
            toast({ title: "Movie unlocked", description: "The assigned picker can now update the movie" });
          });
        },
        "warning"
      );
    } else {
      withConfirm(
        `Lock movie selection for turn starting ${formatWeekLabel(weekOf)}? The picker will no longer be able to change the movie.`,
        async () => {
          await doAction(async () => {
            await apiCall(`/api/admin/groups/${groupId}/unlock-movie`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ weekOf, unlocked: false }),
            });
            toast({ title: "Movie locked" });
          });
        },
        "warning"
      );
    }
  };

  const handleUnlockReviews = async (weekOf: string, unlocked: boolean) => {
    if (unlocked) {
      withConfirm(
        `Re-open the review/rating window for turn starting ${formatWeekLabel(weekOf)}? All members will be able to update their ratings.`,
        async () => {
          await doAction(async () => {
            await apiCall(`/api/admin/groups/${groupId}/unlock-reviews`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ weekOf, unlocked: true }),
            });
            toast({ title: "Review window unlocked" });
          });
        },
        "warning"
      );
    } else {
      withConfirm(
        `Close the review window for turn starting ${formatWeekLabel(weekOf)}? Members will no longer be able to update ratings.`,
        async () => {
          await doAction(async () => {
            await apiCall(`/api/admin/groups/${groupId}/unlock-reviews`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ weekOf, unlocked: false }),
            });
            toast({ title: "Review window closed" });
          });
        },
        "warning"
      );
    }
  };

  const handleRemoveMovie = async (weekOf: string) => {
    withConfirm(
      `Clear the selected movie for turn starting ${formatWeekLabel(weekOf)}? This cannot be undone.`,
      async () => {
        await doAction(async () => {
          await apiCall(`/api/admin/groups/${groupId}/movie`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ weekOf }),
          });
          toast({ title: "Movie cleared" });
        });
      }
    );
  };

  const handleRemoveNomination = async (nominationId: number, title: string) => {
    withConfirm(
      `Remove nomination "${title}" from the pool? This cannot be undone.`,
      async () => {
        await doAction(async () => {
          await apiCall(`/api/admin/groups/${groupId}/nomination`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nominationId }),
          });
          toast({ title: "Nomination removed" });
          setNominationsCache((prev) => {
            const updated = { ...prev };
            if (updated["pool"]) {
              updated["pool"] = updated["pool"].filter((n) => n.id !== nominationId);
            }
            return updated;
          });
        });
      }
    );
  };

  const handleUpdateRole = async (userId: number, username: string, newRole: string) => {
    withConfirm(
      `Change ${username}'s role to "${newRole}"?`,
      async () => {
        await doAction(async () => {
          await apiCall(`/api/groups/${groupId}/role`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, role: newRole }),
          });
          toast({ title: `Role updated to ${newRole}` });
        });
      },
      "warning"
    );
  };

  const handleTransferOwnership = async (userId: number, username: string) => {
    withConfirm(
      `Transfer ownership to ${username}? You will become an admin, and you will lose the ability to transfer ownership back without their consent.`,
      async () => {
        await doAction(async () => {
          await apiCall(`/api/admin/groups/${groupId}/transfer-ownership`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newOwnerId: userId }),
          });
          toast({ title: "Ownership transferred", description: `${username} is now the owner` });
        });
      },
      "warning"
    );
  };

  const handleSaveVoteOverride = async () => {
    if (!editingVote) return;
    const rating = parseFloat(editingVote.rating);
    if (isNaN(rating) || rating < 1 || rating > 10) {
      toast({ title: "Invalid rating", description: "Rating must be between 1 and 10", variant: "destructive" });
      return;
    }
    await doAction(async () => {
      await apiCall(`/api/admin/groups/${groupId}/vote-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: editingVote.userId,
          weekOf: votesWeek,
          rating,
          review: editingVote.review || undefined,
        }),
      });
      toast({ title: "Vote updated" });
      setEditingVote(null);
      loadVotes(votesWeek);
    });
  };

  const handleDeleteVote = async (userId: number, username: string) => {
    withConfirm(
      `Remove ${username}'s vote for turn starting ${formatWeekLabel(votesWeek)}?`,
      async () => {
        await doAction(async () => {
          await apiCall(`/api/admin/groups/${groupId}/vote-override`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: userId, weekOf: votesWeek }),
          });
          toast({ title: "Vote removed" });
          loadVotes(votesWeek);
        });
      }
    );
  };

  const handleSaveSettings = async () => {
    if (!settingsStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(settingsStartDate)) {
      toast({ title: "Invalid start date", description: "Please enter a valid date (YYYY-MM-DD)", variant: "destructive" });
      return;
    }
    const days = parseInt(settingsTurnLength, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      toast({ title: "Invalid turn length", description: "Turn length must be between 1 and 365 days", variant: "destructive" });
      return;
    }
    withConfirm(
      "Changing the start date or turn length will shift all turn boundaries going forward. Existing votes and movies are not moved. Are you sure?",
      async () => {
        setSettingsSaving(true);
        try {
          await apiCall(`/api/admin/groups/${groupId}/settings`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startDate: settingsStartDate, turnLengthDays: days }),
          });
          toast({ title: "Group settings saved" });
          loadSchedule();
          invalidate();
        } catch (e: unknown) {
          toast({ title: "Error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
        } finally {
          setSettingsSaving(false);
        }
      },
      "warning"
    );
  };

  const sectionToggle = (key: string) => setActiveSection(activeSection === key ? null : key);

  const scheduleWeeks = schedule;

  return (
    <div className="min-h-screen bg-background">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          variant={confirm.variant}
          onConfirm={() => { confirm.action(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/groups/${groupId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-serif font-bold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Admin Panel
            </h1>
            <span className="text-xs text-muted-foreground">{group.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-4">

        {/* Picker Schedule Management */}
        <div className="bg-card/50 border border-border/30 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
            onClick={() => sectionToggle("schedule")}
          >
            <div className="flex items-center gap-2.5">
              <CalendarIcon2 className="w-4 h-4 text-primary" />
              <span className="font-serif font-semibold text-foreground">Picker Schedule</span>
            </div>
            {activeSection === "schedule" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {activeSection === "schedule" && (
            <div className="border-t border-border/20">
              {scheduleLoading ? (
                <div className="p-5 space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
              ) : (
                <div className="divide-y divide-border/10">
                  {scheduleWeeks.map((entry, i) => {
                    const isCurrent = entry.weekOf === currentTurnWeekOf;
                    const turnLen = group.turnLengthDays ?? 7;
                    const startOffset = startOffsetInput[entry.weekOf] ?? entry.startOffsetDays ?? 0;
                    const extDays = parseInt(String(extendDaysInput[entry.weekOf] ?? entry.extendedDays), 10);
                    const effectiveStartStr = addDaysToDateStr(entry.weekOf, startOffset);
                    const effectiveDeadlineLastDayStr = addDaysToDateStr(entry.weekOf, turnLen + extDays - 1);
                    return (
                      <div key={`${i}_${entry.weekOf}`} className={`p-4 space-y-3 ${isCurrent ? "bg-primary/5" : ""}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-foreground">
                              {formatCalendarDate(effectiveStartStr)}
                            </span>
                            {isCurrent && (
                              <Badge className="ml-2 bg-primary/20 text-primary border-primary/30 text-xs">Current</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">Deadline: {formatCalendarDate(effectiveDeadlineLastDayStr)}</span>
                        </div>

                        {/* Movie */}
                        <div className="flex items-center gap-2 text-xs">
                          <Film className="w-3.5 h-3.5 text-muted-foreground" />
                          {entry.movie ? (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-foreground truncate">{entry.movie.title}</span>
                              <button
                                className="text-destructive/70 hover:text-destructive flex-shrink-0"
                                title="Clear selected movie"
                                onClick={() => handleRemoveMovie(entry.weekOf)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60 italic">No movie set</span>
                          )}
                        </div>

                        {/* Nominations pool (shown only for current turn) */}
                        {isCurrent && (
                          <div className="text-xs">
                            <button
                              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => {
                                const isOpen = expandedNominationsWeek === entry.weekOf;
                                setExpandedNominationsWeek(isOpen ? null : entry.weekOf);
                                if (!isOpen && !nominationsCache["pool"]) {
                                  loadNominations();
                                }
                              }}
                            >
                              <Star className="w-3 h-3" />
                              <span>Nominations Pool</span>
                              {expandedNominationsWeek === entry.weekOf
                                ? <ChevronUp className="w-3 h-3" />
                                : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {expandedNominationsWeek === entry.weekOf && (
                              <div className="mt-1.5 ml-5 space-y-1">
                                {nominationsLoading && !nominationsCache["pool"] ? (
                                  <span className="text-muted-foreground/60 italic">Loading…</span>
                                ) : (nominationsCache["pool"] ?? []).length === 0 ? (
                                  <span className="text-muted-foreground/60 italic">No nominations in pool</span>
                                ) : (
                                  (nominationsCache["pool"] ?? []).map((nom) => (
                                    <div key={nom.id} className="flex items-center gap-2">
                                      <span className="text-foreground truncate flex-1">{nom.title}</span>
                                      {nom.nominatorUsername && (
                                        <span className="text-muted-foreground/60 flex-shrink-0">by {nom.nominatorUsername}</span>
                                      )}
                                      <button
                                        className="text-destructive/70 hover:text-destructive flex-shrink-0"
                                        title="Remove nomination"
                                        onClick={() => handleRemoveNomination(nom.id, nom.title)}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Picker */}
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          {pickerWeekEdit === entry.weekOf ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <select
                                className="h-7 text-xs rounded-md bg-background border border-border px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                defaultValue={entry.pickerUserId ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPendingPickerMap((prev) => ({ ...prev, [entry.weekOf]: val }));
                                }}
                              >
                                <option value="">— Clear picker —</option>
                                {members.map((m) => (
                                  <option key={m.id} value={m.id}>{m.username}</option>
                                ))}
                              </select>
                              <button
                                className="text-muted-foreground hover:text-primary"
                                title="Save picker"
                                onClick={() => {
                                  const val = pendingPickerMap[entry.weekOf] ?? String(entry.pickerUserId ?? "");
                                  const targetUserId = val === "" ? null : parseInt(val, 10);
                                  const label = targetUserId === null ? "Clear picker" : `Assign ${members.find((m) => m.id === targetUserId)?.username ?? "picker"}`;
                                  withConfirm(
                                    `${label} for turn starting ${formatWeekLabel(entry.weekOf)}?`,
                                    () => handleAssignPicker(entry.weekOf, targetUserId),
                                    "warning"
                                  );
                                }}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="text-muted-foreground hover:text-foreground"
                                title="Cancel"
                                onClick={() => {
                                  setPendingPickerMap((prev) => { const n = { ...prev }; delete n[entry.weekOf]; return n; });
                                  setPickerWeekEdit(null);
                                }}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-foreground">
                                {entry.pickerUsername ?? <span className="text-muted-foreground/60 italic">No picker</span>}
                              </span>
                              <button
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => setPickerWeekEdit(entry.weekOf)}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Turn controls */}
                        <div className="flex flex-wrap gap-2 items-center w-full">
                          {/* Combined date range */}
                          <div className="flex items-center gap-2 w-full">
                            <TurnDateRangeInput
                              weekOf={entry.weekOf}
                              turnLengthDays={group.turnLengthDays ?? 7}
                              extendedDays={parseInt(String(extendDaysInput[entry.weekOf] ?? entry.extendedDays), 10)}
                              startOffsetDays={startOffsetInput[entry.weekOf] ?? entry.startOffsetDays ?? 0}
                              prevDeadlineMs={i > 0 ? scheduleWeeks[i - 1].deadlineMs : null}
                              nextTurnDeadlineMs={i < scheduleWeeks.length - 1 ? scheduleWeeks[i + 1].deadlineMs : null}
                              onStartChange={(offset) => setStartOffsetInput((prev) => ({ ...prev, [entry.weekOf]: offset }))}
                              onDeadlineChange={(days) => setExtendDaysInput((prev) => ({ ...prev, [entry.weekOf]: String(days) }))}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs flex-shrink-0"
                              onClick={() => handleSetTurnDates(entry.weekOf)}
                            >
                              Set
                            </Button>
                          </div>

                          {/* Movie unlock */}
                          <button
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                              entry.movieUnlockedByAdmin
                                ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25"
                                : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50"
                            }`}
                            onClick={() => handleUnlockMovie(entry.weekOf, !entry.movieUnlockedByAdmin)}
                          >
                            {entry.movieUnlockedByAdmin ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            Movie
                          </button>

                          {/* Review unlock */}
                          <button
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                              entry.reviewUnlockedByAdmin
                                ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25"
                                : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50"
                            }`}
                            onClick={() => handleUnlockReviews(entry.weekOf, !entry.reviewUnlockedByAdmin)}
                          >
                            {entry.reviewUnlockedByAdmin ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            Reviews
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Schedule navigation */}
              {!scheduleLoading && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/20">
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { if (schedule.length > 0) loadSchedule(schedule[0].weekOf); }}
                    disabled={scheduleLoading}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Earlier
                  </button>
                  {scheduleCenterWeekOf && scheduleCenterWeekOf !== currentTurnWeekOf && (
                    <button
                      className="text-xs text-primary hover:text-primary/80 transition-colors"
                      onClick={() => loadSchedule()}
                    >
                      Back to current turn
                    </button>
                  )}
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { if (schedule.length > 0) loadSchedule(schedule[schedule.length - 1].weekOf); }}
                    disabled={scheduleLoading}
                  >
                    Later <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vote / Review Overrides */}
        <div className="bg-card/50 border border-border/30 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
            onClick={() => sectionToggle("votes")}
          >
            <div className="flex items-center gap-2.5">
              <Star className="w-4 h-4 text-secondary" />
              <span className="font-serif font-semibold text-foreground">Vote & Review Overrides</span>
            </div>
            {activeSection === "votes" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {activeSection === "votes" && (
            <div className="border-t border-border/20 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Turn:</label>
                <select
                  className="h-7 text-xs rounded-md bg-background border border-border px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={votesWeek}
                  onChange={(e) => { setVotesWeek(e.target.value); }}
                >
                  {scheduleWeeks.map((entry, i) => (
                    <option key={`${i}_${entry.weekOf}`} value={entry.weekOf}>
                      {formatWeekLabel(entry.weekOf)}{entry.movie ? ` — ${entry.movie.title}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Movie context for selected turn */}
              {(() => {
                const selectedEntry = scheduleWeeks.find((e) => e.weekOf === votesWeek);
                return selectedEntry ? (
                  <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                    selectedEntry.movie
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted/20 border border-border/20"
                  }`}>
                    <Film className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    {selectedEntry.movie ? (
                      <div className="flex items-center gap-2 min-w-0">
                        {selectedEntry.movie.poster && (
                          <img
                            src={selectedEntry.movie.poster}
                            alt={selectedEntry.movie.title}
                            className="w-6 h-9 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <span className="font-medium text-foreground truncate">{selectedEntry.movie.title}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60 italic text-xs">No movie selected for this turn</span>
                    )}
                  </div>
                ) : null;
              })()}

              {votesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : votes.length === 0 ? (
                <p className="text-sm text-muted-foreground/60 italic text-center py-4">No votes submitted for this turn.</p>
              ) : (
                <div className="space-y-2">
                  {votes.map((v) => (
                    <div key={v.userId} className="bg-background/40 border border-border/20 rounded-lg p-3">
                      {editingVote?.userId === v.userId ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground w-24 flex-shrink-0">{v.username}</span>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              step={0.1}
                              value={editingVote.rating}
                              onChange={(e) => setEditingVote({ ...editingVote, rating: e.target.value })}
                              className="w-20 h-7 text-xs rounded-md bg-background border border-border px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-xs text-muted-foreground">/10</span>
                          </div>
                          <textarea
                            value={editingVote.review}
                            onChange={(e) => setEditingVote({ ...editingVote, review: e.target.value })}
                            placeholder="Review (optional)"
                            rows={2}
                            className="w-full px-2 py-1.5 text-xs rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={() =>
                              withConfirm("Override this member's vote? This will replace any existing rating and review.", handleSaveVoteOverride, "warning")
                            }>
                              <Check className="w-3 h-3 mr-1" /> Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingVote(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-foreground">{v.username}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Star className="w-3 h-3 text-secondary fill-secondary/60" />
                              <span className="text-xs text-secondary font-bold">{v.rating}</span>
                              {v.review && (
                                <span className="text-xs text-muted-foreground truncate max-w-32 italic">"{v.review}"</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              className="text-muted-foreground hover:text-foreground p-1"
                              onClick={() => setEditingVote({ userId: v.userId, rating: String(v.rating), review: v.review ?? "" })}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="text-destructive/70 hover:text-destructive p-1"
                              onClick={() => handleDeleteVote(v.userId, v.username)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Role Management */}
        <div className="bg-card/50 border border-border/30 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
            onClick={() => sectionToggle("roles")}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-serif font-semibold text-foreground">Role Management</span>
            </div>
            {activeSection === "roles" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {activeSection === "roles" && (
            <div className="border-t border-border/20 p-4">
              <div className="space-y-2">
                {group.members.map((member) => {
                  return (
                    <div key={member.id} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                      <div>
                        <span className="text-sm font-medium text-foreground">{member.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${
                            member.role === "owner"
                              ? "border-primary/40 text-primary"
                              : member.role === "admin"
                              ? "border-secondary/40 text-secondary"
                              : "border-border/40 text-muted-foreground"
                          }`}
                        >
                          {member.role}
                        </Badge>
                        {member.role !== "owner" && isOwner && (
                          <div className="flex items-center gap-1">
                            {member.role !== "admin" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleUpdateRole(member.id, member.username, "admin")}
                              >
                                → Admin
                              </Button>
                            )}
                            {member.role === "admin" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleUpdateRole(member.id, member.username, "member")}
                              >
                                → Member
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                              onClick={() => handleTransferOwnership(member.id, member.username)}
                            >
                              Transfer Ownership
                            </Button>
                          </div>
                        )}
                        {member.role === "admin" && !isOwner && (
                          <span className="text-xs text-muted-foreground/60">(only owner can change)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isOwner && (
                <p className="text-xs text-muted-foreground/60 italic mt-3">
                  Only the group owner can promote, demote, or transfer ownership.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Group Settings */}
        {isAdminOrOwner && (
          <div className="bg-card/50 border border-border/30 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
              onClick={() => sectionToggle("settings")}
            >
              <div className="flex items-center gap-2.5">
                <CalendarIcon2 className="w-4 h-4 text-primary" />
                <span className="font-serif font-semibold text-foreground">Group Settings</span>
              </div>
              {activeSection === "settings" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {activeSection === "settings" && (
              <div className="border-t border-border/20 p-4 space-y-4">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs text-yellow-400 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Changing the start date or turn length shifts all turn boundaries going forward. Existing votes and movies are not re-keyed.</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Group Start Date</label>
                    <Popover open={settingsDateOpen} onOpenChange={setSettingsDateOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs flex items-center gap-2 text-left"
                        >
                          <CalendarIcon2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          {settingsStartDate
                            ? new Date(settingsStartDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : <span className="text-muted-foreground/60">Pick a date</span>}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={settingsStartDate ? new Date(settingsStartDate + "T00:00:00") : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const y = date.getFullYear();
                              const m = String(date.getMonth() + 1).padStart(2, "0");
                              const d = String(date.getDate()).padStart(2, "0");
                              setSettingsStartDate(`${y}-${m}-${d}`);
                              setSettingsDateOpen(false);
                            }
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground/60 mt-1">The date when turn 1 began</p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Turn Length (days)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={settingsTurnLength}
                      onChange={(e) => setSettingsTurnLength(e.target.value)}
                      className="h-9 w-24 text-sm rounded-md bg-background border border-border px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground/60 mt-1">Default length for each turn in days</p>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {settingsSaving ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
