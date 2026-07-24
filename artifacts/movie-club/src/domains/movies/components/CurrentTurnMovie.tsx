import { useEffect, useState } from "react";
import { Film, Clock, Clapperboard, BookOpen, Plus, ExternalLink } from "lucide-react";
import type { GroupDetail, GroupStatus } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { normalizeWeekOf } from "@/domains/turns/turnUtils";
import { getMovieUrl } from "@/lib/letterboxd";

function CountdownTimer({ deadlineMs }: { deadlineMs: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    const timer = window.setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const diff = deadlineMs - now;
  if (diff <= 0) {
    return (
      <span className="movie-countdown" role="timer">
        <span className="movie-countdown-label">Reveal</span>{" "}
        <span className="crt-yellow">--:--</span>
      </span>
    );
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="movie-countdown" title="Time until scores reveal" role="timer">
      <span className="movie-countdown-label">Reveal in</span>{" "}
      <span className="crt-yellow">
        {days > 0 ? `${days}d ` : ""}{p(hours)}h {p(mins)}m
      </span>
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
  const { data: me } = useGetMe();
  const movieLinkPreference = me?.movieLinkPreference ?? "letterboxd";
  const movieHref = movie ? getMovieUrl(movie.title, movie.imdbId, movieLinkPreference) : "";
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    setPosterFailed(false);
  }, [movie?.poster]);

  const hasPoster = !!movie?.poster && !posterFailed;

  return (
    <section className="current-turn-movie border-4 sm:border-8 border-primary bg-card mb-4 sm:mb-8 overflow-hidden">
      <div className="current-movie-layout md:flex">
        {/* Movie Poster */}
        <div className="current-movie-poster md:w-2/5 p-3 sm:p-8 flex items-center justify-center bg-card">
          {hasPoster && movie ? (
            <a
              href={movieHref}
              target="_blank"
              rel="noopener noreferrer"
              className="current-movie-poster-link flex justify-center"
              aria-label={`Open ${movie.title} in your preferred movie app`}
            >
              <img
                src={movie.poster ?? ""}
                alt={movie.title}
                width={500}
                height={750}
                loading="eager"
                fetchPriority="high"
                onError={() => setPosterFailed(true)}
                className="movie-poster-image max-h-[38vh] md:max-h-none w-auto max-w-full h-auto object-contain border-4 sm:border-8 border-secondary hover:border-primary transition-colors"
              />
            </a>
          ) : (
            <div className="w-32 h-48 sm:w-48 sm:h-72 bg-card border-4 sm:border-8 border-secondary flex items-center justify-center">
              <Film className="w-12 h-12 sm:w-16 sm:h-16 text-secondary/50" />
            </div>
          )}
        </div>

        {/* Movie Info */}
        <div className="current-movie-info p-3 sm:p-8 md:w-3/5 flex flex-col justify-center bg-card">
          {movie ? (
            <>
              <h2 className="current-movie-title text-xl sm:text-4xl font-black text-primary mb-2 sm:mb-4 uppercase tracking-tight">
                <a
                  href={movieHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline inline-flex items-center gap-2"
                  aria-label={`Open ${movie.title} in your preferred movie app`}
                >
                  {movie.title}
                  <ExternalLink className="w-5 h-5 opacity-50" />
                </a>
              </h2>
              <div className="current-movie-metadata flex flex-wrap gap-2 text-xs sm:text-sm text-white mb-3 sm:mb-6">
                {movie.year && (
                  <span className="px-2.5 py-1 sm:px-4 sm:py-2 bg-secondary border-2 border-primary font-bold">
                    {movie.year}
                  </span>
                )}
                {movie.runtime && (
                  <span className="px-2.5 py-1 sm:px-4 sm:py-2 bg-secondary border-2 border-white/30 font-bold flex items-center gap-1.5 sm:gap-2">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {movie.runtime}
                  </span>
                )}
                {movie.director && (
                  <span className="px-2.5 py-1 sm:px-4 sm:py-2 bg-secondary border-2 border-white/30 font-bold">
                    {movie.director}
                  </span>
                )}
              </div>
              {movie.genre && (
                <div className="current-movie-genres flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-6">
                  {movie.genre.split(",").map((g) => (
                    <span
                      key={g.trim()}
                      className="px-2 py-1 sm:px-3 sm:py-1.5 bg-secondary text-white border-2 border-white/30 text-xs sm:text-sm font-bold uppercase"
                    >
                      {g.trim()}
                    </span>
                  ))}
                </div>
              )}
              <div className="current-movie-attribution pt-3 sm:pt-4 border-t-4 border-secondary">
                {(movie.setByUsername ?? group.pickerUsername) && (
                  <div className="movie-credit flex items-center gap-2 sm:gap-3 mb-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary flex items-center justify-center flex-shrink-0">
                      <Clapperboard className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-white/70 uppercase tracking-wider font-bold">Picked by</p>
                      <p className="font-black text-white text-sm sm:text-lg">{movie.setByUsername ?? group.pickerUsername}</p>
                    </div>
                  </div>
                )}
                {movie.nominatorUsername && (
                  <div className="movie-credit flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-secondary border-2 border-primary flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-white/70 uppercase tracking-wider font-bold">Nominated by</p>
                      <p className="font-bold text-white text-sm sm:text-base">{movie.nominatorUsername}</p>
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

        </div>
      </div>

      {/* Full-width VCR control deck. Keeping this outside the poster/details
          columns makes both sides finish evenly and gives the readouts room. */}
      {status && isCurrentWeek && movie && (
        <div className="current-movie-status" aria-live="polite">
          {status.votingOpen ? (
            <span className="osd-readout osd-rec">
              <span className="osd-dot" aria-hidden="true" />
              <span className="crt-yellow">Rec · Rating Open</span>
            </span>
          ) : status.resultsAvailable ? (
            <span className="osd-readout osd-play">
              <span className="osd-glyph" aria-hidden="true">▶</span>
              <span className="crt-yellow">Results Ready</span>
            </span>
          ) : (
            <span className="osd-readout osd-standby">
              <span className="osd-glyph" aria-hidden="true">❚❚</span>
              <span className="crt-yellow">Standby</span>
            </span>
          )}
          {status.deadlineMs && <CountdownTimer deadlineMs={status.deadlineMs} />}
          {canEditMovie && (
            <button
              onClick={onEditMovie}
              className="current-movie-change-button bg-secondary border-2 border-white/30 hover:border-primary text-white hover:text-primary"
            >
              <Plus className="w-4 h-4" />
              Change
            </button>
          )}
        </div>
      )}

      {movie && canEditMovie && (!status || !isCurrentWeek) && (
        <div className="current-movie-change">
          <button
            onClick={onEditMovie}
            className="current-movie-change-button bg-secondary border-2 border-white/30 hover:border-primary text-white hover:text-primary"
          >
            <Plus className="w-4 h-4" />
            Change
          </button>
        </div>
      )}

    </section>
  );
}
