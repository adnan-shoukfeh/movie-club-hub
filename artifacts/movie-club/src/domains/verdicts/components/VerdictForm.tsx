import { useState, useEffect } from "react";
import { Star, Check, Pencil, Trash2, Send } from "lucide-react";
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

interface VerdictFormProps {
  group: GroupDetail;
  status: GroupStatus;
  groupId: number;
  selectedWeek: string;
}

export function VerdictForm({ group, status, groupId, selectedWeek }: VerdictFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [editingVote, setEditingVote] = useState(false);
  const [showVoteSuccess, setShowVoteSuccess] = useState(false);
  const [pendingVote, setPendingVote] = useState<{ rating: number; review?: string } | null>(null);

  useEffect(() => {
    if (pendingVote && status.hasVoted) {
      setPendingVote(null);
    }
  }, [pendingVote, status.hasVoted]);

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
      setRating(0);
      setReviewText("");
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleStartEdit = () => {
    if (status.myVote !== null && status.myVote !== undefined) {
      setRating(Math.round(status.myVote / 2));
    } else {
      setRating(0);
    }
    setReviewText(status.myReview ?? "");
    setEditingVote(true);
  };

  const handleVote = () => {
    const ratingValue = rating * 2;
    const submittedReview = reviewText.trim() || undefined;
    setPendingVote({ rating: ratingValue, review: submittedReview });
    submitVote.mutate(
      { groupId, data: { rating: ratingValue, review: submittedReview, weekOf: selectedWeek } },
      {
        onSuccess: () => {
          setEditingVote(false);
          setShowVoteSuccess(true);
          setTimeout(() => setShowVoteSuccess(false), 3000);
          invalidate();
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
    <div className="border-4 border-secondary bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-black text-primary text-2xl uppercase tracking-tight">
          {hasVotedOrPending && !editingVote ? "Your Rating" : "Rate & Review"}
        </h3>
        {hasVotedOrPending && !editingVote && !pendingVote && (
          <button
            onClick={handleStartEdit}
            className="px-4 py-2 bg-secondary border-2 border-white/30 hover:border-primary text-white hover:text-primary transition-all font-bold uppercase text-sm flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {/* Watched status toggle */}
      <div className="flex items-center gap-3 mb-6 pb-6 border-b-4 border-secondary">
        <span className="text-sm text-white/70 font-bold uppercase">Watched?</span>
        <button
          onClick={() => handleWatchedToggle(true)}
          disabled={setWatchStatus.isPending || !!pendingVote}
          className={`px-4 py-2 border-2 font-bold uppercase text-sm flex items-center gap-2 transition-all ${
            isWatchedOrPending
              ? "bg-primary text-secondary border-primary"
              : "bg-secondary text-white border-white/30 hover:border-primary"
          }`}
        >
          <Check className="w-4 h-4" />
          Yes
        </button>
        <button
          onClick={handleNotYet}
          disabled={setWatchStatus.isPending || hasVotedOrPending}
          title={hasVotedOrPending ? "Clear your rating first" : undefined}
          className={`px-4 py-2 border-2 font-bold uppercase text-sm transition-all ${
            !isWatchedOrPending
              ? "bg-secondary text-white border-primary"
              : "bg-secondary text-white/50 border-white/20 hover:border-white/40"
          }`}
        >
          Not Yet
        </button>
      </div>

      {/* Success banner */}
      {showVoteSuccess && (
        <div className="mb-6 p-4 bg-primary border-4 border-secondary text-secondary font-black uppercase flex items-center gap-2">
          <Check className="w-5 h-5" />
          Rating saved! Results unlock Monday.
        </div>
      )}

      {isWatchedOrPending && (
        hasVotedOrPending && !editingVote ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star
                    key={value}
                    className={`w-8 h-8 ${
                      value <= Math.round((displayRating ?? 0) / 2)
                        ? "fill-primary text-primary"
                        : "text-secondary"
                    }`}
                  />
                ))}
              </div>
              <div className="px-4 py-2 bg-primary border-4 border-secondary">
                <span className="text-2xl font-black text-secondary">
                  {displayRating?.toFixed(1)}
                </span>
              </div>
            </div>
            {displayReview && (
              <div className="p-4 bg-secondary border-l-8 border-primary">
                <p className="text-white italic">"{displayReview}"</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Star rating */}
            <div>
              <label className="block text-sm font-black text-white mb-3 uppercase tracking-widest">
                Your Rating
              </label>
              <div className="flex gap-2 items-center">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(value)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-10 h-10 transition-colors ${
                        value <= (hoverRating || rating)
                          ? "fill-primary text-primary"
                          : "text-secondary"
                      }`}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <div className="ml-3 px-4 py-2 bg-primary border-4 border-secondary">
                    <span className="text-2xl font-black text-secondary">
                      {(rating * 2).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Review */}
            <div>
              <label className="block text-sm font-black text-white mb-3 uppercase tracking-widest">
                Your Review (Optional)
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your thoughts about the movie..."
                className="w-full px-4 py-3 border-4 border-secondary bg-card text-white placeholder:text-white/40 focus:outline-none focus:border-primary resize-none font-medium"
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleVote}
                disabled={rating === 0 || submitVote.isPending}
                className="flex-1 px-6 py-3 bg-primary text-secondary border-4 border-secondary hover:bg-secondary hover:text-primary hover:border-primary disabled:bg-secondary disabled:text-white/30 disabled:cursor-not-allowed disabled:border-secondary transition-all font-black uppercase flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                {submitVote.isPending ? "Saving..." : editingVote ? "Update Rating" : "Submit Rating"}
              </button>
              {editingVote && (
                <>
                  <button
                    onClick={() => setEditingVote(false)}
                    className="px-6 py-3 bg-secondary text-white border-4 border-white/30 hover:border-primary hover:text-primary transition-all font-black uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => clearVoteMutation.mutate()}
                    disabled={clearVoteMutation.isPending}
                    className="px-6 py-3 bg-destructive text-white border-4 border-destructive hover:bg-secondary hover:border-destructive transition-all font-black uppercase flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
