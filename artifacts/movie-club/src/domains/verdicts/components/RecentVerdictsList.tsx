import { Star, Film } from "lucide-react";
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
            onClick={() => setLocation(`/groups/${result.groupId}/results?weekOf=${result.weekOf}`)}
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
              <div className="absolute top-2 right-2 bg-primary text-secondary px-2.5 py-1.5 flex items-center gap-1.5 border-2 border-secondary">
                <Star className="w-3.5 h-3.5 fill-secondary text-secondary" />
                <span className="font-black text-sm">{result.averageRating.toFixed(1)}</span>
              </div>
            </div>
            <h4 className="font-bold text-white truncate">{result.movie}</h4>
            <p className="text-sm text-white/70">{result.groupName}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
