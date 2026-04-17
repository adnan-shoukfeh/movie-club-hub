import { useState } from "react";
import { useGetResults, getGetResultsQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams, useSearch } from "wouter";
import { ArrowLeft, Star, Trophy, Users, Clock, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

function getCurrentWeekOf(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday);
  return monday.toISOString().slice(0, 10);
}

function offsetWeekOf(weekOf: string, offset: number): string {
  const d = new Date(weekOf + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + offset * 7);
  return d.toISOString().slice(0, 10);
}

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
  const currentWeek = getCurrentWeekOf();
  const initialWeek = qp.get("weekOf") ?? currentWeek;

  const [selectedWeek, setSelectedWeek] = useState(initialWeek);

  const { data: results, isLoading, error } = useGetResults(
    groupId,
    { weekOf: selectedWeek },
    { query: { queryKey: [...getGetResultsQueryKey(groupId), selectedWeek], enabled: !!groupId } }
  );

  const movie = results?.movieData;
  const maxCount = results ? Math.max(...results.distribution.map((d) => d.count), 1) : 1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/groups/${groupId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-secondary" />
            <span className="font-serif font-semibold">Results</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-5">

        {/* Week navigation */}
        <div className="flex items-center justify-between bg-card/30 border border-border/20 rounded-xl px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedWeek(offsetWeekOf(selectedWeek, -1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {selectedWeek === currentWeek ? "This Week" : "Week of"}
            </p>
            <p className="text-xs text-muted-foreground">{formatWeekLabel(selectedWeek)}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedWeek(offsetWeekOf(selectedWeek, 1))}
            disabled={selectedWeek >= currentWeek}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {error || !results ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/40 mb-4" />
            <p className="text-foreground font-medium mb-2">Results not available</p>
            <p className="text-muted-foreground/60 text-sm">
              Results unlock Monday at midnight after everyone has had a chance to rate.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => setLocation(`/groups/${groupId}`)}>
              Back to Group
            </Button>
          </div>
        ) : (
          <>
            {/* Movie header with poster */}
            {movie?.poster ? (
              <div className="rounded-xl overflow-hidden border border-border/20">
                {movie.imdbId ? (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdbId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative h-52 block hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover opacity-50"
                      style={{ objectPosition: "center 20%" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/95" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="text-muted-foreground text-xs mb-1">This week's film</p>
                      <h1 className="font-serif text-2xl font-bold text-foreground">{movie.title}</h1>
                      {movie.year && <p className="text-xs text-white/60 mt-0.5">{movie.year}</p>}
                    </div>
                  </a>
                ) : (
                  <div className="relative h-52">
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover opacity-50"
                      style={{ objectPosition: "center 20%" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/95" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="text-muted-foreground text-xs mb-1">This week's film</p>
                      <h1 className="font-serif text-2xl font-bold text-foreground">{movie.title}</h1>
                      {movie.year && <p className="text-xs text-white/60 mt-0.5">{movie.year}</p>}
                    </div>
                  </div>
                )}
                {(movie.genre || movie.runtime || movie.director) && (
                  <div className="bg-card/60 border-t border-border/20 px-5 py-3 flex flex-wrap gap-3">
                    {movie.genre && (
                      <span className="text-xs text-muted-foreground bg-muted/40 rounded-full px-2.5 py-1">
                        {movie.genre}
                      </span>
                    )}
                    {movie.runtime && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {movie.runtime}
                      </span>
                    )}
                    {movie.director && (
                      <span className="text-xs text-muted-foreground">Dir. {movie.director}</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground text-sm mb-1">This week's film</p>
                <h1 className="font-serif text-3xl font-bold text-foreground">
                  {movie?.title ?? `Week of ${formatWeekLabel(results.weekOf)}`}
                </h1>
                {movie && (movie.genre || movie.runtime || movie.director) && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {movie.genre && (
                      <span className="text-xs text-muted-foreground bg-muted/40 rounded-full px-2.5 py-1">
                        {movie.genre}
                      </span>
                    )}
                    {movie.runtime && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {movie.runtime}
                      </span>
                    )}
                    {movie.director && (
                      <span className="text-xs text-muted-foreground">Dir. {movie.director}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Score card */}
            <div className="bg-card/50 border border-border/30 rounded-xl p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Star className="w-5 h-5 text-secondary fill-secondary/60" />
                  </div>
                  <div className="text-4xl font-serif font-bold text-foreground">{results.averageRating}</div>
                  <div className="text-xs text-muted-foreground mt-1">Average rating</div>
                </div>
                <div className="text-center border-l border-border/30">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Users className="w-5 h-5 text-primary/60" />
                  </div>
                  <div className="text-4xl font-serif font-bold text-foreground">{results.totalVotes}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total ratings</div>
                </div>
              </div>
            </div>

            {/* Distribution chart */}
            <div className="bg-card/50 border border-border/30 rounded-xl p-5">
              <h2 className="font-serif text-lg font-semibold mb-4">Rating Distribution</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={results.distribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="rating"
                    tick={{ fontSize: 12, fill: "hsl(0 0% 65%)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "hsl(0 0% 65%)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "hsl(0 0% 6%)",
                      border: "1px solid hsl(0 0% 14%)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "hsl(0 0% 98%)",
                    }}
                    formatter={(value: any) => [`${value} rating${value !== 1 ? "s" : ""}`, ""]}
                    labelFormatter={(label) => `Rating: ${label}/10`}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {results.distribution.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.count === maxCount && entry.count > 0
                            ? "hsl(43 96% 58%)"
                            : entry.count > 0
                            ? "hsl(346 84% 45% / 0.7)"
                            : "hsl(0 0% 16%)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Rating breakdown */}
              <div className="mt-4 space-y-1.5">
                {results.distribution
                  .filter((d) => d.count > 0)
                  .sort((a, b) => b.rating - a.rating)
                  .map((d) => (
                    <div key={d.rating} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-8 text-right">{d.rating}/10</span>
                      <div className="flex-1 bg-muted/30 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-primary/70 transition-all"
                          style={{ width: `${(d.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8">{d.count}x</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Member reviews */}
            {results.votes.length > 0 && (
              <div className="bg-card/50 border border-border/30 rounded-xl p-5">
                <h2 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Member Reviews
                </h2>
                <div className="space-y-4">
                  {results.votes
                    .sort((a, b) => b.rating - a.rating)
                    .map((vote, i) => (
                      <div key={i} className="border-b border-border/10 last:border-0 pb-4 last:pb-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-foreground">{vote.username}</span>
                          <div className="flex items-center gap-1 bg-secondary/10 border border-secondary/20 rounded-full px-2.5 py-0.5">
                            <Star className="w-3 h-3 text-secondary fill-secondary/60" />
                            <span className="text-secondary text-sm font-bold">{vote.rating}</span>
                            <span className="text-muted-foreground text-xs">/10</span>
                          </div>
                        </div>
                        {vote.review ? (
                          <p className="text-sm text-foreground/70 italic">"{vote.review}"</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/50">No review left</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
