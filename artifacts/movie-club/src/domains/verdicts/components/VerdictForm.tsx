import { useState, useEffect, useRef } from "react";
import { Star, Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useSubmitVerdict,
  useSetWatchStatus,
  getGetGroupQueryKey,
  getGetGroupStatusQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { GroupDetail, GroupStatus } from "@workspace/api-client-react";

const ITEM_H = 48;

function WheelPicker({
  items,
  selectedIndex,
  onIndexChange,
  disabled = false,
}: {
  items: string[];
  selectedIndex: number;
  onIndexChange: (idx: number) => void;
  disabled?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const suppressRef = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    suppressRef.current = true;
    el.scrollTop = selectedIndex * ITEM_H;
    const t = setTimeout(() => { suppressRef.current = false; }, 80);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  const handleScroll = () => {
    if (suppressRef.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const el = listRef.current;
      if (!el) return;
      const idx = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      onIndexChange(idx);
    }, 80);
  };

  return (
    <div
      className={`relative select-none ${disabled ? "opacity-25 pointer-events-none" : ""}`}
      style={{ width: 56, height: ITEM_H * 3 }}
    >
      <div
        className="absolute inset-x-0 z-10 pointer-events-none border-y border-primary/50 bg-primary/10 rounded-sm"
        style={{ top: ITEM_H, height: ITEM_H }}
      />
      <div className="absolute inset-x-0 top-0 h-10 z-10 pointer-events-none bg-gradient-to-b from-card to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-10 z-10 pointer-events-none bg-gradient-to-t from-card to-transparent" />
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-scroll"
        style={{ scrollbarWidth: "none", scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <div style={{ height: ITEM_H }} />
        {items.map((item, i) => (
          <div
            key={i}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            className="flex items-center justify-center cursor-pointer"
            onClick={() => {
              onIndexChange(i);
              suppressRef.current = true;
              listRef.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
              setTimeout(() => { suppressRef.current = false; }, 400);
            }}
          >
            <span
              className={`font-bold tabular-nums transition-all duration-150 ${
                i === selectedIndex
                  ? "text-foreground text-2xl"
                  : Math.abs(i - selectedIndex) === 1
                  ? "text-muted-foreground/50 text-lg"
                  : "text-muted-foreground/20 text-base"
              }`}
            >
              {item}
            </span>
          </div>
        ))}
        <div style={{ height: ITEM_H }} />
      </div>
    </div>
  );
}

const INT_ITEMS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const DEC_ITEMS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

interface VerdictFormProps {
  group: GroupDetail;
  status: GroupStatus;
  groupId: number;
  selectedWeek: string;
}

export function VerdictForm({ group, status, groupId, selectedWeek }: VerdictFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [intIdx, setIntIdx] = useState(6);
  const [decIdx, setDecIdx] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [editingVote, setEditingVote] = useState(false);
  const [showVoteSuccess, setShowVoteSuccess] = useState(false);
  const [pendingVote, setPendingVote] = useState<{ rating: number; review?: string } | null>(null);

  useEffect(() => {
    if (intIdx === 9) setDecIdx(0);
  }, [intIdx]);

  const intValue = intIdx + 1;
  const effectiveRating = intValue === 10 ? 10 : intValue + decIdx / 10;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetGroupStatusQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  const submitVote = useSubmitVerdict();
  const setWatchStatus = useSetWatchStatus();

  const clearVoteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/vote`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekOf: selectedWeek }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not clear vote");
      }
      return res.json();
    },
    onSuccess: () => {
      setEditingVote(false);
      setIntIdx(6);
      setDecIdx(0);
      setReviewText("");
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleStartEdit = () => {
    if (status.myVote !== null && status.myVote !== undefined) {
      const v = status.myVote;
      const int = Math.min(10, Math.max(1, Math.floor(v)));
      const dec = int === 10 ? 0 : Math.round((v - int) * 10);
      setIntIdx(int - 1);
      setDecIdx(dec);
    } else {
      setIntIdx(6);
      setDecIdx(0);
    }
    setReviewText(status.myReview ?? "");
    setEditingVote(true);
  };

  const handleVote = () => {
    const rounded = Math.round(effectiveRating * 10) / 10;
    const submittedReview = reviewText.trim() || undefined;
    setPendingVote({ rating: rounded, review: submittedReview });
    submitVote.mutate(
      { groupId, data: { rating: rounded, review: submittedReview, weekOf: selectedWeek } },
      {
        onSuccess: () => {
          setEditingVote(false);
          setShowVoteSuccess(true);
          setTimeout(() => setShowVoteSuccess(false), 3000);
          if (!group.myWatched) {
            setWatchStatus.mutate({ groupId, data: { watched: true, weekOf: selectedWeek } }, {
              onSuccess: () => {
                invalidate();
                setPendingVote(null);
              },
            });
          } else {
            invalidate();
            setPendingVote(null);
          }
        },
        onError: (e: any) => {
          setPendingVote(null);
          toast({ title: "Error", description: e.data?.error ?? "Could not submit vote", variant: "destructive" });
        },
      }
    );
  };

  const handleNotYet = () => {
    setEditingVote(false);
    setWatchStatus.mutate(
      { groupId, data: { watched: false, weekOf: selectedWeek } },
      {
        onSuccess: () => invalidate(),
        onError: (e: any) => {
          toast({ title: "Error", description: e.data?.error, variant: "destructive" });
        },
      }
    );
  };

  const handleWatchedToggle = (watched: boolean) => {
    setWatchStatus.mutate(
      { groupId, data: { watched, weekOf: selectedWeek } },
      {
        onSuccess: () => invalidate(),
        onError: (e: any) => {
          toast({ title: "Error", description: e.data?.error, variant: "destructive" });
        },
      }
    );
  };

  const hasVotedOrPending = status.hasVoted || !!pendingVote;
  const isWatchedOrPending = group.myWatched || !!pendingVote;
  const displayRating = status.myVote ?? pendingVote?.rating;
  const displayReview = status.myReview ?? pendingVote?.review;

  return (
    <div className="bg-card/50 border border-border/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold">
          {hasVotedOrPending && !editingVote ? "Your Rating" : "Rate this Film"}
        </h2>
        {hasVotedOrPending && !editingVote && !pendingVote && (
          <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={handleStartEdit}>
            <Pencil className="w-3 h-3 mr-1.5" />
            Edit
          </Button>
        )}
      </div>

      {/* Watched status toggle */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border/20">
        <span className="text-xs text-muted-foreground mr-1">Watched?</span>
        <Button
          size="sm"
          variant={isWatchedOrPending ? "default" : "outline"}
          className={`h-7 text-xs ${isWatchedOrPending ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : ""}`}
          onClick={() => handleWatchedToggle(true)}
          disabled={setWatchStatus.isPending || !!pendingVote}
        >
          <Check className="w-3 h-3 mr-1" />
          Watched
        </Button>
        <Button
          size="sm"
          variant={!isWatchedOrPending ? "default" : "outline"}
          className={`h-7 text-xs ${!isWatchedOrPending ? "bg-muted hover:bg-muted/80 text-foreground" : ""}`}
          onClick={handleNotYet}
          disabled={setWatchStatus.isPending || hasVotedOrPending}
          title={hasVotedOrPending ? "Clear your rating first" : undefined}
        >
          Not Yet
        </Button>
        {hasVotedOrPending && (
          <span className="text-xs text-muted-foreground/60 italic">Clear your rating to change this</span>
        )}
      </div>

      {/* 3-second success banner */}
      {showVoteSuccess && (
        <div className="mb-4 flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-3 py-2 text-sm">
          <Check className="w-4 h-4 shrink-0" />
          Rating saved! Results unlock Monday.
        </div>
      )}

      {isWatchedOrPending && (
        hasVotedOrPending && !editingVote ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-background/60 border border-border/40 rounded-lg px-4 py-2">
                <Star className="w-4 h-4 text-secondary fill-secondary/60" />
                <span className="text-secondary font-bold text-lg tabular-nums">{displayRating}</span>
                <span className="text-muted-foreground text-sm">/ 10</span>
              </div>
            </div>
            {displayReview && (
              <div className="bg-muted/20 rounded-lg px-4 py-3 text-sm text-foreground/80 italic border border-border/20">
                "{displayReview}"
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Wheel picker */}
            <div>
              <p className="text-xs text-muted-foreground mb-3">Select your rating</p>
              <div className="flex items-center justify-center gap-1">
                <div className="bg-card border border-border/40 rounded-xl overflow-hidden">
                  <WheelPicker
                    items={INT_ITEMS}
                    selectedIndex={intIdx}
                    onIndexChange={setIntIdx}
                  />
                </div>
                <span className="text-2xl font-bold text-muted-foreground/60 pb-0.5 w-5 text-center">.</span>
                <div className="bg-card border border-border/40 rounded-xl overflow-hidden">
                  <WheelPicker
                    items={DEC_ITEMS}
                    selectedIndex={decIdx}
                    onIndexChange={setDecIdx}
                    disabled={intIdx === 9}
                  />
                </div>
              </div>
            </div>

            {/* Review */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Review (optional)</p>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="What did you think? (hidden until reveal)"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={submitVote.isPending}
                onClick={handleVote}
              >
                {submitVote.isPending
                  ? "Saving..."
                  : editingVote
                  ? `Update — ${effectiveRating.toFixed(1)}/10`
                  : `Submit — ${effectiveRating.toFixed(1)}/10`}
              </Button>
              {editingVote && (
                <>
                  <Button variant="ghost" onClick={() => setEditingVote(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive/70 hover:text-destructive"
                    disabled={clearVoteMutation.isPending}
                    onClick={() => clearVoteMutation.mutate()}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
