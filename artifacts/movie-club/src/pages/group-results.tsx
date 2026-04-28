import { useState, useEffect } from "react";
import { useGetVerdicts, useGetGroup, getGetResultsQueryKey, getGetGroupQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams, useSearch } from "wouter";
import { ArrowLeft, Star, Award, Users, Clock, ChevronLeft, ChevronRight, Film, User, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VHSNoise } from "@/components/ui/vhs-noise";
import { offsetWeekOf, getTurnIndexForDate } from "@/domains/turns/turnUtils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

function formatWeekLabel(weekOf: string): string {
  const d = new Date(weekOf + "T00:00:00.000Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function GroupResults() {
  const params = useParams<{ groupId: string }>();
  const groupId = parseInt(params.groupId ?? "0", 10);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const qp = new URLSearchParams(search);
  const initialWeekParam = qp.get("weekOf");

  const [selectedWeek, setSelectedWeek] = useState(initialWeekParam ?? "");

  const { data: group, isLoading: groupLoading } = useGetGroup(
    groupId,
    { weekOf: selectedWeek || undefined },
    { query: { queryKey: [...getGetGroupQueryKey(groupId), selectedWeek], enabled: !!groupId } }
  );

  useEffect(() => {
    if (group?.currentTurnWeekOf && selectedWeek === "") {
      setSelectedWeek(initialWeekParam ?? group.currentTurnWeekOf);
    }
  }, [group?.currentTurnWeekOf, selectedWeek, initialWeekParam]);

  const { data: results, isLoading, error } = useGetVerdicts(
    groupId,
    { weekOf: selectedWeek },
    { query: { queryKey: [...getGetResultsQueryKey(groupId), selectedWeek], enabled: !!groupId && !!selectedWeek } }
  );

  const turnConfig = group?.turnConfig;
  const currentTurnIndex = turnConfig ? getTurnIndexForDate(group.currentTurnWeekOf, turnConfig) : 0;
  const selectedTurnIndex = turnConfig && selectedWeek ? getTurnIndexForDate(selectedWeek, turnConfig) : 0;

  const movie = results?.movieData;
  const maxCount = results ? Math.max(...results.distribution.map((d) => d.count), 1) : 1;

  if (isLoading || groupLoading || !selectedWeek) {
    return (
      <div className="min-h-screen bg-background p-6 relative">
        <VHSNoise />
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <VHSNoise />

      <header className="border-b-4 border-primary sticky top-0 z-10 bg-secondary">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation(`/groups/${groupId}`)}
              className="text-white hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center">
                <Award className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h1 className="font-black text-primary uppercase">Final Results</h1>
                <p className="text-sm text-white/80">{group?.name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => turnConfig && setSelectedWeek(offsetWeekOf(selectedWeek, -1, turnConfig))}
            disabled={!turnConfig || selectedTurnIndex <= 0}
            className="p-3 bg-card border-4 border-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all"
          >
            <ChevronLeft className="w-6 h-6 text-primary" />
          </button>

          <div className="text-center bg-primary px-6 py-3 border-4 border-secondary">
            <p className="text-sm text-secondary font-bold mb-1">
              {formatWeekLabel(selectedWeek)}
            </p>
            <span className="inline-block px-4 py-1 bg-secondary text-primary text-xs font-black uppercase tracking-wider">
              Turn {selectedTurnIndex + 1}
              {selectedTurnIndex === currentTurnIndex && " (Current)"}
            </span>
          </div>

          <button
            onClick={() => turnConfig && setSelectedWeek(offsetWeekOf(selectedWeek, 1, turnConfig))}
            disabled={!turnConfig || selectedTurnIndex >= currentTurnIndex}
            className="p-3 bg-card border-4 border-secondary disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-all"
          >
            <ChevronRight className="w-6 h-6 text-primary" />
          </button>
        </div>

        {error || !results ? (
          <div className="border-4 border-secondary bg-card p-12 text-center">
            <Award className="w-16 h-16 text-secondary/50 mx-auto mb-4" />
            <p className="text-white font-bold uppercase mb-2">Results not available</p>
            <p className="text-white/60 text-sm mb-6">
              Results unlock Monday at midnight after everyone has had a chance to rate.
            </p>
            <button
              onClick={() => setLocation(`/groups/${groupId}`)}
              className="px-6 py-3 bg-primary text-secondary border-4 border-secondary hover:bg-secondary hover:text-primary hover:border-primary transition-all font-black uppercase"
            >
              Back to Group
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Movie header */}
            <div className="border-8 border-primary bg-card overflow-hidden">
              <div className="md:flex">
                <div className="md:w-1/3 p-8 flex items-center justify-center bg-black">
                  {movie?.poster ? (
                    movie.imdbId ? (
                      <a
                        href={`https://www.imdb.com/title/${movie.imdbId}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={movie.poster}
                          alt={movie.title}
                          className="max-w-full h-auto border-8 border-secondary hover:border-primary transition-colors"
                        />
                      </a>
                    ) : (
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        className="max-w-full h-auto border-8 border-secondary"
                      />
                    )
                  ) : (
                    <div className="w-48 h-72 bg-card border-8 border-secondary flex items-center justify-center">
                      <Film className="w-16 h-16 text-secondary/50" />
                    </div>
                  )}
                </div>
                <div className="p-8 md:w-2/3 flex flex-col justify-center">
                  <h2 className="text-4xl font-black text-primary mb-4 uppercase tracking-tight">
                    {movie?.title ?? "Unknown Film"}
                  </h2>
                  {movie && (
                    <div className="flex flex-wrap gap-3 text-sm text-white mb-6">
                      {movie.year && (
                        <span className="px-4 py-2 bg-secondary border-2 border-primary font-bold">
                          {movie.year}
                        </span>
                      )}
                      {movie.runtime && (
                        <span className="px-4 py-2 bg-secondary border-2 border-white/30 font-bold flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {movie.runtime}
                        </span>
                      )}
                      {movie.director && (
                        <span className="px-4 py-2 bg-secondary border-2 border-white/30 font-bold">
                          {movie.director}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Score cards */}
            <div className="border-8 border-primary bg-secondary p-8">
              <div className="flex items-center gap-3 mb-8 pb-4 border-b-4 border-primary">
                <div className="w-12 h-12 bg-primary flex items-center justify-center">
                  <Award className="w-7 h-7 text-secondary" />
                </div>
                <h3 className="text-3xl font-black text-primary uppercase">Final Results</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-8 bg-card border-4 border-primary">
                  <p className="text-sm font-black text-primary mb-4 uppercase tracking-widest">
                    Average Rating
                  </p>
                  <div className="flex items-center gap-4">
                    <Star className="w-10 h-10 fill-primary text-primary" />
                    <span className="text-6xl font-black text-white">
                      {results.averageRating}
                    </span>
                    <span className="text-2xl text-white/60 mt-4 font-bold">/10</span>
                  </div>
                </div>

                <div className="p-8 bg-card border-4 border-white/30">
                  <p className="text-sm font-black text-white mb-4 uppercase tracking-widest">
                    Participation
                  </p>
                  <div className="flex items-center gap-4">
                    <Users className="w-10 h-10 text-primary" />
                    <span className="text-6xl font-black text-white">
                      {results.totalVotes}
                    </span>
                    <span className="text-2xl text-white/60 mt-4 font-bold">votes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Distribution chart */}
            <div className="border-4 border-secondary bg-card p-6">
              <h3 className="font-black text-primary mb-6 text-xl flex items-center gap-2 uppercase">
                <TrendingUp className="w-6 h-6" />
                Rating Distribution
              </h3>
              <ResponsiveContainer width="100%" height={200}>
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
                    formatter={(value: any) => [`${value} rating${value !== 1 ? "s" : ""}`, ""]}
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

            {/* Member reviews */}
            {results.votes.length > 0 && (
              <div className="border-4 border-secondary bg-card p-6">
                <h4 className="font-black text-primary mb-6 text-2xl flex items-center gap-3 uppercase pb-4 border-b-4 border-secondary">
                  <Star className="w-7 h-7 fill-primary" />
                  Member Reviews
                </h4>

                <div className="space-y-4">
                  {results.votes
                    .sort((a, b) => b.rating - a.rating)
                    .map((vote, i) => (
                      <div
                        key={i}
                        className="p-5 bg-secondary border-l-8 border-primary"
                      >
                        <div className="flex items-start gap-4 mb-3">
                          <div className="w-14 h-14 bg-primary flex items-center justify-center">
                            <User className="w-7 h-7 text-secondary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-white mb-2 text-lg">{vote.username}</p>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-4 h-4 ${
                                      star <= vote.rating
                                        ? "fill-primary text-primary"
                                        : "text-white/20"
                                    }`}
                                  />
                                ))}
                              </div>
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
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
