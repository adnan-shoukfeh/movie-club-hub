import { useState } from "react";
import { useGetVerdicts, getGetResultsQueryKey } from "@workspace/api-client-react";
import type { Member } from "@workspace/api-client-react";
import {
  Star,
  Award,
  Users,
  TrendingUp,
  User,
  Skull,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ReactionBar } from "@/domains/reactions";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/ui/star-rating";
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

  // Determine who didn't submit a rating (shame dungeon members)
  const voterUsernames = new Set(results.votes.map((v) => v.username));
  const shameDungeonMembers = members.filter((m) => !voterUsernames.has(m.username));

  // TODO: Add sorting/filtering options for reviews
  // Options to consider: by rating, by reaction count, by submission time
  // See design doc: docs/superpowers/specs/2026-04-30-inline-turn-results-design.md
  const sortedVotes = [...results.votes].sort((a, b) => b.rating - a.rating);

  return (
    <div className="space-y-6">
      {/* Collapsible Results Summary */}
      <div className="border-8 border-primary bg-secondary">
        <button
          onClick={() => setSummaryExpanded(!summaryExpanded)}
          className="w-full p-6 flex items-center justify-between hover:bg-secondary/80 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary flex items-center justify-center">
              <Award className="w-7 h-7 text-secondary" />
            </div>
            <h3 className="text-2xl font-black text-primary uppercase">Final Results</h3>
          </div>
          {summaryExpanded ? (
            <ChevronUp className="w-6 h-6 text-primary" />
          ) : (
            <ChevronDown className="w-6 h-6 text-primary" />
          )}
        </button>

        {summaryExpanded && (
          <div className="px-6 pb-6 space-y-6">
            {/* Score cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 bg-card border-4 border-primary">
                <p className="text-sm font-black text-primary mb-3 uppercase tracking-widest">
                  Average Rating
                </p>
                <div className="flex items-center gap-3">
                  <Star className="w-8 h-8 fill-primary text-primary" />
                  <span className="text-5xl font-black text-white">
                    {results.averageRating}
                  </span>
                  <span className="text-xl text-white/60 mt-2 font-bold">/10</span>
                </div>
              </div>

              <div className="p-6 bg-card border-4 border-white/30">
                <p className="text-sm font-black text-white mb-3 uppercase tracking-widest">
                  Participation
                </p>
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary" />
                  <span className="text-5xl font-black text-white">
                    {results.totalVotes}
                  </span>
                  <span className="text-xl text-white/60 mt-2 font-bold">votes</span>
                </div>
              </div>
            </div>

            {/* Distribution chart */}
            <div className="border-4 border-card bg-card p-4">
              <h4 className="font-black text-primary mb-4 text-lg flex items-center gap-2 uppercase">
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
      </div>

      {/* Member Reviews */}
      {sortedVotes.length > 0 && (
        <div className="border-4 border-secondary bg-card p-6">
          <h4 className="font-black text-primary mb-6 text-xl flex items-center gap-3 uppercase pb-4 border-b-4 border-secondary">
            <Star className="w-6 h-6 fill-primary" />
            Member Reviews
          </h4>

          <div className="space-y-4">
            {(sortedVotes as Array<typeof sortedVotes[number] & { id?: number }>).map((vote, i) => (
              <div
                key={vote.id ?? i}
                className="p-5 bg-secondary border-l-8 border-primary"
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-12 h-12 bg-primary flex items-center justify-center">
                    <User className="w-6 h-6 text-secondary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-white mb-2 text-lg">{vote.username}</p>
                    <div className="flex items-center gap-2 mb-2">
                      <StarRating rating={vote.rating} size="sm" />
                      <span className="px-3 py-1 bg-primary border-2 border-card font-black text-secondary text-sm">
                        {vote.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
                {vote.review && (
                  <p className="text-sm text-white leading-relaxed pl-16 mt-2 border-t-2 border-white/20 pt-3 italic">
                    "{vote.review}"
                  </p>
                )}
                {vote.id && (
                  <div className="pl-16 mt-3">
                    <ReactionBar
                      entityType="verdict"
                      entityId={vote.id}
                      groupId={groupId}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shame Dungeon */}
      {shameDungeonMembers.length > 0 && (
        <div className="border-4 border-secondary bg-card p-6">
          <h4 className="font-black text-primary mb-4 text-xl flex items-center gap-2 uppercase">
            <Skull className="w-6 h-6" />
            Shame Dungeon
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {shameDungeonMembers.map((member) => (
              <div key={member.id} className="p-3 bg-secondary border-2 border-white/20 opacity-50">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-primary flex items-center justify-center">
                    <User className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{member.username}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
