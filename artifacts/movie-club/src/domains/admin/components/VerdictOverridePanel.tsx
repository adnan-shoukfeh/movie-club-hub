import { useState, useEffect, useCallback } from "react";
import {
  Star,
  ChevronDown,
  ChevronUp,
  Film,
  Check,
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDateET } from "@/lib/utils";
import { apiCall, ConfirmDialog, type ScheduleEntry } from "./shared";

interface VoteEntry {
  userId: number;
  username: string;
  rating: number;
  review: string | null;
}

interface VerdictOverridePanelProps {
  groupId: number;
  schedule: ScheduleEntry[];
  currentTurnWeekOf: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function formatWeekLabel(weekOf: string): string {
  return formatDateET(weekOf);
}

export function VerdictOverridePanel({
  groupId,
  schedule,
  currentTurnWeekOf,
  isExpanded,
  onToggle,
}: VerdictOverridePanelProps) {
  const { toast } = useToast();
  const [votesWeek, setVotesWeek] = useState("");
  const [votes, setVotes] = useState<VoteEntry[]>([]);
  const [votesLoading, setVotesLoading] = useState(false);
  const [editingVote, setEditingVote] = useState<{ userId: number; rating: string; review: string } | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void; variant?: "destructive" | "warning" } | null>(null);

  const withConfirm = (message: string, action: () => void, variant: "destructive" | "warning" = "destructive") => {
    setConfirm({ message, action, variant });
  };

  useEffect(() => {
    if (currentTurnWeekOf && votesWeek === "") {
      setVotesWeek(currentTurnWeekOf);
    }
  }, [currentTurnWeekOf, votesWeek]);

  const loadVotes = useCallback(async (weekOf: string) => {
    if (!groupId || !weekOf) return;
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
    if (isExpanded && votesWeek) loadVotes(votesWeek);
  }, [isExpanded, votesWeek, loadVotes]);

  const doAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    }
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

  const selectedEntry = schedule.find((e) => e.weekOf === votesWeek);

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
            <Star className="w-4 h-4 text-secondary" />
            <span className="font-serif font-semibold text-foreground">Vote & Review Overrides</span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {isExpanded && (
          <div className="border-t border-border/20 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Turn:</label>
              <select
                className="h-7 text-xs rounded-md bg-background border border-border px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={votesWeek}
                onChange={(e) => { setVotesWeek(e.target.value); }}
              >
                {schedule.map((entry, i) => (
                  <option key={`${i}_${entry.weekOf}`} value={entry.weekOf}>
                    {formatWeekLabel(entry.weekOf)}{entry.movie ? ` — ${entry.movie.title}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Movie context for selected turn */}
            {selectedEntry && (
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
            )}

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
    </>
  );
}
