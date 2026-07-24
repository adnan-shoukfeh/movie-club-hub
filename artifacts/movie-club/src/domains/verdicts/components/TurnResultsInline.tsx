import { useState } from "react";
import { useGetVerdicts, getGetResultsQueryKey } from "@workspace/api-client-react";
import type { Member } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Star,
  Award,
  Users,
  TrendingUp,
  Skull,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Send,
} from "lucide-react";
import { UserLink } from "@/domains/profiles/components/UserLink";
import { ReactionBar } from "@/domains/reactions";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/ui/star-rating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface TurnResultsInlineProps {
  groupId: number;
  selectedWeek: string;
  members: Member[];
}

interface ReviewReply {
  id: number;
  verdictId: number;
  userId: number;
  username: string;
  body: string;
  createdAt: string;
  avatarUrl?: string | null;
}

function ReviewReplies({
  groupId,
  selectedWeek,
  verdictId,
  replies,
}: {
  groupId: number;
  selectedWeek: string;
  verdictId: number;
  replies: ReviewReply[];
}) {
  const [replying, setReplying] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReviewReply | null>(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const submitReply = async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/verdicts/${verdictId}/replies`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Could not add reply");
      }
      setBody("");
      setReplying(false);
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: [...getGetResultsQueryKey(groupId), selectedWeek] });
    } catch (err) {
      toast({
        title: "Reply failed",
        description: err instanceof Error ? err.message : "Could not add reply",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const startReply = (target: ReviewReply | null = null) => {
    setReplyingTo(target);
    setBody(target ? `@${target.username} ` : "");
    setReplying(true);
  };

  const cancelReply = () => {
    setReplying(false);
    setReplyingTo(null);
    setBody("");
  };

  return (
    <div className="review-replies pl-16 mt-3 space-y-3">
      {replies.length > 0 && (
        <div className="review-replies__list space-y-2 border-l-2 border-white/20 pl-3">
          {replies.map((reply) => (
            <div key={reply.id} className="review-reply flex items-start gap-2">
              <UserLink userId={reply.userId}>
                <Avatar className="w-7 h-7 border border-primary">
                  <AvatarImage src={reply.avatarUrl ?? undefined} alt={reply.username} />
                  <AvatarFallback className="bg-primary text-secondary text-[10px] font-bold">
                    {reply.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </UserLink>
              <div className="min-w-0 flex-1">
                <UserLink userId={reply.userId} className="inline-block">
                  <span className="text-xs font-black text-white hover:text-primary transition-colors">
                    {reply.username}
                  </span>
                </UserLink>
                <p className="review-reply__copy text-sm text-white/80 leading-relaxed whitespace-pre-wrap break-words">
                  {reply.body}
                </p>
                <div className="review-reply__actions">
                  <button
                    type="button"
                    onClick={() => startReply(reply)}
                    className="review-reply-target text-[11px] text-white/55 hover:text-primary font-bold uppercase inline-flex items-center gap-1.5"
                    aria-label={`Reply to ${reply.username}`}
                  >
                    <MessageCircle className="w-3 h-3" aria-hidden="true" />
                    Reply
                  </button>
                  <div className="review-reply__reactions">
                    <ReactionBar
                      entityType="verdict_reply"
                      entityId={reply.id}
                      groupId={groupId}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {replying ? (
        <div className="review-reply-composer space-y-2">
          {replyingTo && (
            <div className="review-reply-context" role="status">
              Replying to <strong>@{replyingTo.username}</strong>
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={2}
            className="review-reply-input w-full bg-card border-2 border-white/20 text-white text-sm p-2 focus:outline-none focus:border-primary resize-none"
            placeholder="Reply..."
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submitReply}
              disabled={submitting || body.trim().length === 0}
              className="review-reply-submit px-3 py-1.5 bg-primary text-secondary font-black uppercase text-xs border-2 border-primary disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              Send
            </button>
            <button
              onClick={cancelReply}
              className="px-3 py-1.5 text-white/70 hover:text-white text-xs font-bold uppercase"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => startReply()}
          className="review-reply-trigger text-xs text-white/60 hover:text-primary font-bold uppercase flex items-center gap-1.5"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Reply
        </button>
      )}
    </div>
  );
}

export function TurnResultsInline({ groupId, selectedWeek, members }: TurnResultsInlineProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  const { data: results, isLoading, error } = useGetVerdicts(
    groupId,
    { weekOf: selectedWeek },
    {
      query: {
        queryKey: [...getGetResultsQueryKey(groupId), selectedWeek],
        enabled: !!groupId && !!selectedWeek,
      },
    }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="border-4 border-secondary bg-card p-8 text-center">
        <Award className="w-12 h-12 text-secondary/50 mx-auto mb-3" />
        <p className="text-white font-bold uppercase">Results unavailable</p>
      </div>
    );
  }

  const maxCount = Math.max(...results.distribution.map((d) => d.count), 1);

  // Only verdicts where the member watched and submitted a rating count as votes;
  // everyone else (no verdict, or explicitly didn't watch) goes in the shame dungeon.
  const ratedVotes = results.votes.filter((v) => v.watched && v.rating > 0);
  const voterUsernames = new Set(ratedVotes.map((v) => v.username));
  const shameDungeonMembers = members.filter((m) => !voterUsernames.has(m.username));

  // TODO: Add sorting/filtering options for reviews
  // Options to consider: by rating, by reaction count, by submission time
  // See design doc: docs/superpowers/specs/2026-04-30-inline-turn-results-design.md
  const sortedVotes = [...ratedVotes].sort((a, b) => b.rating - a.rating);

  return (
    <div className="turn-results-terminal space-y-6">
      {/* Collapsible Results Summary */}
      <section className="results-summary-deck border-8 border-primary bg-secondary">
        <button
          onClick={() => setSummaryExpanded(!summaryExpanded)}
          className="results-summary-header w-full p-6 flex items-center justify-between hover:bg-secondary/80 transition-colors"
          aria-expanded={summaryExpanded}
        >
          <div className="flex items-center gap-3">
            <div className="results-summary-icon w-12 h-12 bg-primary flex items-center justify-center">
              <Award className="w-7 h-7 text-secondary" />
            </div>
            <h3 className="results-display-title text-2xl font-black text-primary uppercase">Final Results</h3>
          </div>
          {summaryExpanded ? (
            <ChevronUp className="w-6 h-6 text-primary" />
          ) : (
            <ChevronDown className="w-6 h-6 text-primary" />
          )}
        </button>

        {summaryExpanded && (
          <div className="results-summary-body px-6 pb-6 space-y-6">
            {/* Score cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="results-score-card results-score-card--rating p-6 bg-card border-4 border-primary">
                <p className="results-label text-sm font-black text-primary mb-3 uppercase tracking-widest">
                  Average Rating
                </p>
                <div className="flex items-center gap-3">
                  <Star className="w-8 h-8 fill-primary text-primary" />
                  <span className="results-value text-5xl font-black text-white">
                    {results.averageRating}
                  </span>
                  <span className="text-xl text-white/60 mt-2 font-bold">/10</span>
                </div>
              </div>

              <div className="results-score-card results-score-card--participation p-6 bg-card border-4 border-white/30">
                <p className="results-label text-sm font-black text-white mb-3 uppercase tracking-widest">
                  Participation
                </p>
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary" />
                  <span className="results-value text-5xl font-black text-white">
                    {results.totalVotes}
                  </span>
                  <span className="text-xl text-white/60 mt-2 font-bold">votes</span>
                </div>
              </div>
            </div>

            {/* Distribution chart */}
            <div className="results-distribution border-4 border-card bg-card p-4">
              <h4 className="results-section-title font-black text-primary mb-4 text-lg flex items-center gap-2 uppercase">
                <TrendingUp className="w-5 h-5" />
                Rating Distribution
              </h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={results.distribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="rating"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,48,135,0.3)" }}
                    contentStyle={{
                      background: "#001d3d",
                      border: "4px solid #003087",
                      borderRadius: "0",
                      fontSize: "12px",
                      color: "#ffffff",
                    }}
                    formatter={(value: number) => [`${value} rating${value !== 1 ? "s" : ""}`, ""]}
                    labelFormatter={(label) => `Rating: ${label}/10`}
                  />
                  <Bar dataKey="count" radius={0}>
                    {results.distribution.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.count === maxCount && entry.count > 0
                            ? "#FDB913"
                            : entry.count > 0
                            ? "#003087"
                            : "#001d3d"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Member Reviews */}
      {sortedVotes.length > 0 && (
        <section className="member-reviews-deck border-4 border-secondary bg-card p-6">
          <h4 className="results-section-title font-black text-primary mb-6 text-xl flex items-center gap-3 uppercase pb-4 border-b-4 border-secondary">
            <Star className="w-6 h-6 fill-primary" />
            Member Reviews
          </h4>

          <div className="space-y-4">
            {sortedVotes.map((vote) => (
              <div
                key={vote.id}
                className="member-review-tape p-5 bg-secondary border-l-8 border-primary"
              >
                <div className="flex items-start gap-4 mb-3">
                  <UserLink userId={vote.userId}>
                    <Avatar className="w-12 h-12 border-2 border-primary">
                      <AvatarImage src={vote.avatarUrl ?? undefined} alt={vote.username} />
                      <AvatarFallback className="bg-primary text-secondary font-bold">
                        {vote.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </UserLink>
                  <div className="flex-1">
                    <UserLink userId={vote.userId} className="inline-block">
                      <p className="member-review-name font-black text-white mb-2 text-lg hover:text-primary transition-colors">{vote.username}</p>
                    </UserLink>
                    <div className="flex items-center gap-2 mb-2">
                      <StarRating rating={vote.rating} size="sm" />
                      <span className="px-3 py-1 bg-primary border-2 border-card font-black text-secondary text-sm">
                        {vote.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
                {vote.review && (
                  <p className="member-review-copy text-sm text-white leading-relaxed pl-16 mt-2 border-t-2 border-white/20 pt-3 italic">
                    "{vote.review}"
                  </p>
                )}
                <div className="member-review-reactions pl-16 mt-3">
                  <ReactionBar
                    entityType="verdict"
                    entityId={vote.id}
                    groupId={groupId}
                  />
                </div>
                <ReviewReplies
                  groupId={groupId}
                  selectedWeek={selectedWeek}
                  verdictId={vote.id}
                  replies={((vote as unknown as { replies?: ReviewReply[] }).replies ?? [])}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shame Dungeon */}
      {shameDungeonMembers.length > 0 && (
        <section className="shame-dungeon-deck border-4 border-secondary bg-card p-6">
          <h4 className="shame-dungeon-title font-black text-primary mb-4 text-xl flex items-center gap-2 uppercase">
            <Skull className="w-6 h-6" />
            Shame Dungeon
          </h4>
          <div className="shame-dungeon-grid grid grid-cols-2 sm:grid-cols-4 gap-4">
            {shameDungeonMembers.map((member) => (
              <div key={member.id} className="shame-dungeon-card p-3 bg-secondary border-2 border-white/20 opacity-50">
                <div className="flex items-center gap-2">
                  <UserLink userId={member.id}>
                    <Avatar className="w-10 h-10 border-2 border-primary">
                      <AvatarImage src={member.avatarUrl ?? undefined} alt={member.username} />
                      <AvatarFallback className="bg-primary text-secondary text-sm font-bold">
                        {member.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </UserLink>
                  <div className="flex-1 min-w-0">
                    <UserLink userId={member.id} className="block">
                      <p className="shame-dungeon-name text-sm font-bold text-white truncate hover:text-primary transition-colors">{member.username}</p>
                    </UserLink>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
