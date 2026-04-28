import { Film, Clock, Clapperboard, BookOpen, Plus } from "lucide-react";
import type { GroupDetail, GroupStatus } from "@workspace/api-client-react";
import { normalizeWeekOf } from "@/domains/turns/turnUtils";

function CountdownTimer({ deadlineMs }: { deadlineMs: number }) {
  const now = Date.now();
  const diff = deadlineMs - now;
  if (diff <= 0) return <span className="text-white/60 text-sm font-bold">Rating closed</span>;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return (
    <span className="text-white/60 text-sm font-bold">
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
  const selectedNorm = normalizeWeekOf(selectedWeek);
  const currentNorm = normalizeWeekOf(currentTurnWeekOf);
  const isCurrentWeek = selectedNorm === currentNorm;
  const isPastWeek = selectedNorm < currentNorm;
  const isAdminOrOwner = group.myRole === "owner" || group.myRole === "admin";
  const movie = group.movieData;

  return (
    <div className="border-8 border-primary bg-card mb-8 overflow-hidden">
      <div className="md:flex">
        {/* Movie Poster */}
        <div className="md:w-2/5 p-8 flex items-center justify-center bg-black">
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

        {/* Movie Info */}
        <div className="p-8 md:w-3/5 flex flex-col justify-center bg-card">
          {movie ? (
            <>
              <h2 className="text-4xl font-black text-primary mb-4 uppercase tracking-tight">
                {movie.title}
              </h2>
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
              {movie.genre && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {movie.genre.split(",").map((g) => (
                    <span
                      key={g.trim()}
                      className="px-3 py-1.5 bg-secondary text-white border-2 border-white/30 text-sm font-bold uppercase"
                    >
                      {g.trim()}
                    </span>
                  ))}
                </div>
              )}
              <div className="pt-4 border-t-4 border-secondary">
                {(movie.setByUsername ?? group.pickerUsername) && (
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-primary flex items-center justify-center">
                      <Clapperboard className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs text-white/70 uppercase tracking-wider font-bold">Picked by</p>
                      <p className="font-black text-white text-lg">{movie.setByUsername ?? group.pickerUsername}</p>
                    </div>
                  </div>
                )}
                {movie.nominatorUsername && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary border-2 border-primary flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-white/70 uppercase tracking-wider font-bold">Nominated by</p>
                      <p className="font-bold text-white">{movie.nominatorUsername}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Film className="w-16 h-16 text-secondary/50 mx-auto mb-4" />
              <p className="text-white/60 font-bold uppercase">
                {selectedWeek > currentTurnWeekOf
                  ? isAdminOrOwner
                    ? "Set a movie for this turn"
                    : "No movie set yet"
                  : "No movie was set"}
              </p>
              {canEditMovie && (
                <button
                  onClick={onEditMovie}
                  className="mt-4 px-6 py-3 bg-primary text-secondary border-4 border-secondary hover:bg-secondary hover:text-primary hover:border-primary transition-all font-black uppercase flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-5 h-5" />
                  Set Movie
                </button>
              )}
            </div>
          )}

          {/* Status bar */}
          {status && isCurrentWeek && movie && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t-4 border-secondary">
              <div>
                {status.votingOpen ? (
                  <span className="px-4 py-2 bg-primary text-secondary text-sm font-black uppercase">
                    Rating Open
                  </span>
                ) : status.resultsAvailable ? (
                  <span className="px-4 py-2 bg-secondary border-2 border-primary text-primary text-sm font-black uppercase">
                    Results Ready
                  </span>
                ) : (
                  <span className="px-4 py-2 bg-secondary border-2 border-white/30 text-white/60 text-sm font-black uppercase">
                    Waiting
                  </span>
                )}
              </div>
              {status.deadlineMs && <CountdownTimer deadlineMs={status.deadlineMs} />}
              {canEditMovie && movie && (
                <button
                  onClick={onEditMovie}
                  className="px-4 py-2 bg-secondary border-2 border-white/30 hover:border-primary text-white hover:text-primary transition-all font-bold uppercase text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Change
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
