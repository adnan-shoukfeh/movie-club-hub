import { Film, Clock, Clapperboard, BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GroupDetail, GroupStatus } from "@workspace/api-client-react";

function CountdownTimer({ deadlineMs }: { deadlineMs: number }) {
  const now = Date.now();
  const diff = deadlineMs - now;
  if (diff <= 0) return <span className="text-muted-foreground text-sm">Rating closed</span>;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return (
    <span className="text-muted-foreground text-sm">
      {days > 0 ? `${days}d ` : ""}{hours}h {mins}m until reveal
    </span>
  );
}

interface CurrentTurnMovieProps {
  group: GroupDetail;
  status: GroupStatus | undefined;
  selectedWeek: string;
  canEditMovie: boolean;
  onEditMovie: () => void;
}

export function CurrentTurnMovie({
  group,
  status,
  selectedWeek,
  canEditMovie,
  onEditMovie,
}: CurrentTurnMovieProps) {
  const currentTurnWeekOf = group.currentTurnWeekOf;
  const isCurrentWeek = selectedWeek === currentTurnWeekOf;
  const isPastWeek = selectedWeek < currentTurnWeekOf;
  const isAdminOrOwner = group.myRole === "owner" || group.myRole === "admin";
  const movie = group.movieData;

  return (
    <div className="bg-card/50 border border-border/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          {isCurrentWeek ? "This Turn" : isPastWeek ? "Past Turn" : "Future Turn"}
        </h2>
        {canEditMovie && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onEditMovie}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {movie ? "Change" : "Set movie"}
          </Button>
        )}
      </div>

      {movie ? (
        <div className="flex gap-4">
          {movie.poster ? (
            movie.imdbId ? (
              <a
                href={`https://www.imdb.com/title/${movie.imdbId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <img
                  src={movie.poster}
                  alt={movie.title}
                  className="w-16 h-24 object-cover rounded-lg shadow-lg hover:opacity-80 transition-opacity"
                />
              </a>
            ) : (
              <img
                src={movie.poster}
                alt={movie.title}
                className="w-16 h-24 object-cover rounded-lg flex-shrink-0 shadow-lg"
              />
            )
          ) : (
            <div className="w-16 h-24 bg-muted/40 rounded-lg flex-shrink-0 flex items-center justify-center">
              <Film className="w-6 h-6 text-muted-foreground/50" />
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <h3 className="font-serif text-lg font-bold text-foreground leading-tight">{movie.title}</h3>
            {movie.year && <p className="text-xs text-muted-foreground mt-0.5">{movie.year}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              {movie.genre && (
                <span className="text-xs text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5">
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
            <div className="mt-2 space-y-0.5">
              {(movie.setByUsername ?? group.pickerUsername) && (
                <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <Clapperboard className="w-3 h-3" />
                  Picked by <span className="font-medium text-muted-foreground">{movie.setByUsername ?? group.pickerUsername}</span>
                </p>
              )}
              {movie.nominatorUsername && (
                <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  Nominated by <span className="font-medium text-muted-foreground">{movie.nominatorUsername}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground/60 text-sm italic">
          {selectedWeek > currentTurnWeekOf
            ? isAdminOrOwner
              ? "Set a movie for this upcoming turn."
              : "No movie set yet for this turn."
            : "No movie was set for this turn."}
        </p>
      )}

      {status && isCurrentWeek && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/20">
          <div className="flex items-center gap-2">
            {status.votingOpen ? (
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Rating open</Badge>
            ) : status.resultsAvailable ? (
              <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs">Revealed</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">No movie</Badge>
            )}
          </div>
          {status.deadlineMs && <CountdownTimer deadlineMs={status.deadlineMs} />}
        </div>
      )}
    </div>
  );
}
