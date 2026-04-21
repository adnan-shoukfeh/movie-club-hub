import { useState, useCallback, useEffect } from "react";
import {
  Calendar as CalendarIcon2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Film,
  Star,
  UserCheck,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDateET } from "@/lib/utils";
import {
  apiCall,
  formatCalendarDate,
  addDaysToDateStr,
  ConfirmDialog,
  TurnDateRangeInput,
  type ScheduleEntry,
  type AdminMember,
} from "./shared";
import { UnlockControls } from "./UnlockControls";

interface PickerScheduleEditorProps {
  groupId: number;
  turnLengthDays: number;
  isExpanded: boolean;
  onToggle: () => void;
  onScheduleLoaded?: (schedule: ScheduleEntry[], currentTurnWeekOf: string) => void;
  /** Increment to trigger a schedule reload from outside (e.g. after settings change). */
  reloadKey?: number;
}

function formatWeekLabel(weekOf: string): string {
  return formatDateET(weekOf);
}

export function PickerScheduleEditor({
  groupId,
  turnLengthDays,
  isExpanded,
  onToggle,
  onScheduleLoaded,
  reloadKey,
}: PickerScheduleEditorProps) {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [currentTurnWeekOf, setCurrentTurnWeekOf] = useState<string>("");
  const [scheduleCenterWeekOf, setScheduleCenterWeekOf] = useState<string | undefined>(undefined);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void; variant?: "destructive" | "warning" } | null>(null);

  const [extendDaysInput, setExtendDaysInput] = useState<{ [weekOf: string]: string }>({});
  const [startOffsetInput, setStartOffsetInput] = useState<{ [weekOf: string]: number }>({});
  const [pickerWeekEdit, setPickerWeekEdit] = useState<string | null>(null);
  const [pendingPickerMap, setPendingPickerMap] = useState<Record<string, string>>({});
  const [expandedNominationsWeek, setExpandedNominationsWeek] = useState<string | null>(null);
  const [nominationsCache, setNominationsCache] = useState<{ [weekOf: string]: { id: number; title: string; nominatorUsername?: string }[] }>({});
  const [nominationsLoading, setNominationsLoading] = useState(false);

  const withConfirm = (message: string, action: () => void, variant: "destructive" | "warning" = "destructive") => {
    setConfirm({ message, action, variant });
  };

  const loadSchedule = useCallback(async (centerWeekOf?: string) => {
    if (!groupId) return;
    setScheduleLoading(true);
    try {
      const url = centerWeekOf
        ? `/api/admin/groups/${groupId}/schedule?centerWeekOf=${encodeURIComponent(centerWeekOf)}`
        : `/api/admin/groups/${groupId}/schedule`;
      const data = await apiCall<{ schedule: ScheduleEntry[]; members: AdminMember[]; currentTurnWeekOf?: string; centerWeekOf?: string }>(url);
      setSchedule(data.schedule ?? []);
      setMembers(data.members ?? []);
      if (data.currentTurnWeekOf) setCurrentTurnWeekOf(data.currentTurnWeekOf);
      if (data.centerWeekOf) setScheduleCenterWeekOf(data.centerWeekOf);
      if (data.currentTurnWeekOf && onScheduleLoaded) {
        onScheduleLoaded(data.schedule ?? [], data.currentTurnWeekOf);
      }
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    } finally {
      setScheduleLoading(false);
    }
  }, [groupId, toast, onScheduleLoaded]);

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

  useEffect(() => {
    if (groupId) loadSchedule();
  }, [groupId, loadSchedule]);

  useEffect(() => {
    if (reloadKey && groupId) loadSchedule();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const doAction = async (action: () => Promise<void>) => {
    try {
      await action();
      loadSchedule(scheduleCenterWeekOf);
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
    const entry = schedule.find((e) => e.weekOf === weekOf);
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

  return (
    <>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          variant={confirm.variant}
          onConfirm={() => { confirm.action(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="bg-card/50 border border-border/30 rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
          onClick={onToggle}
        >
          <div className="flex items-center gap-2.5">
            <CalendarIcon2 className="w-4 h-4 text-primary" />
            <span className="font-serif font-semibold text-foreground">Picker Schedule</span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {isExpanded && (
          <div className="border-t border-border/20">
            {scheduleLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {schedule.map((entry, i) => {
                  const isCurrent = entry.weekOf === currentTurnWeekOf;
                  const startOffset = startOffsetInput[entry.weekOf] ?? entry.startOffsetDays ?? 0;
                  const extDays = parseInt(String(extendDaysInput[entry.weekOf] ?? entry.extendedDays), 10);
                  const effectiveStartStr = addDaysToDateStr(entry.weekOf, startOffset);
                  const effectiveDeadlineLastDayStr = addDaysToDateStr(entry.weekOf, turnLengthDays + extDays - 1);
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
                            turnLengthDays={turnLengthDays}
                            extendedDays={parseInt(String(extendDaysInput[entry.weekOf] ?? entry.extendedDays), 10)}
                            startOffsetDays={startOffsetInput[entry.weekOf] ?? entry.startOffsetDays ?? 0}
                            prevDeadlineMs={i > 0 ? schedule[i - 1].deadlineMs : null}
                            nextTurnDeadlineMs={i < schedule.length - 1 ? schedule[i + 1].deadlineMs : null}
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

                        <UnlockControls
                          movieUnlocked={entry.movieUnlockedByAdmin}
                          reviewUnlocked={entry.reviewUnlockedByAdmin}
                          onToggleMovie={() => handleUnlockMovie(entry.weekOf, !entry.movieUnlockedByAdmin)}
                          onToggleReview={() => handleUnlockReviews(entry.weekOf, !entry.reviewUnlockedByAdmin)}
                        />
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
    </>
  );
}
