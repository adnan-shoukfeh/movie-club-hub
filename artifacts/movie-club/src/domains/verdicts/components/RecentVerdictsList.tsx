import { Star, Film, UserRound } from "lucide-react";
import type { RecentResult } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface RecentVerdictsListProps {
  results: RecentResult[];
}

export function RecentVerdictsList({ results }: RecentVerdictsListProps) {
  const [, setLocation] = useLocation();

  if (results.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-6 bg-primary px-6 py-3 border-4 border-secondary inline-flex items-center gap-3">
        <Star className="w-6 h-6 text-secondary fill-secondary" />
        <h2 className="text-xl font-black text-secondary uppercase tracking-wide">Recently Watched</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {results.map((result, i) => (
          <button
            key={i}
            onClick={() => setLocation(`/groups/${result.groupId}?weekOf=${result.weekOf}`)}
            className="group cursor-pointer text-left"
          >
            <div className="relative aspect-[2/3] overflow-hidden mb-2 border-4 border-secondary group-hover:border-primary transition-all bg-black">
              {result.moviePoster ? (
                <img
                  src={result.moviePoster}
                  alt={result.movie}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-card">
                  <Film className="w-12 h-12 text-secondary/30" />
                </div>
              )}
              {result.reviewsUnlocked === false && result.averageRating != null && (
                <div className="absolute top-2 right-2 bg-primary text-secondary px-2.5 py-1.5 flex items-center gap-1.5 border-2 border-secondary">
                  <Star className="w-3.5 h-3.5 fill-secondary text-secondary" />
                  <span className="font-black text-sm">{result.averageRating.toFixed(1)}</span>
                </div>
              )}
            </div>
            <h4 className="font-bold text-white truncate">{result.movie}</h4>
            <p className="text-sm text-white/70 truncate">{result.groupName}</p>
            <div className="mt-1.5 text-[11px] leading-snug text-white/55">
              {result.pickerUsername && (
                <div className="flex items-center gap-1.5 min-w-0">
                  {result.pickerAvatarUrl ? (
                    <img
                      src={result.pickerAvatarUrl}
                      alt=""
                      className="w-3.5 h-3.5 rounded-full object-cover border border-primary/50 shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full bg-secondary border border-primary/40 shrink-0 flex items-center justify-center">
                      <UserRound className="w-2.5 h-2.5 text-primary/80" />
                    </span>
                  )}
                  <span className="truncate">Picked by {result.pickerUsername}</span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
