import { Star } from "lucide-react";
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
      <h2 className="font-serif text-xl font-semibold text-foreground mb-4">Recent Results</h2>
      <div className="grid gap-3">
        {results.map((result, i) => (
          <button
            key={i}
            onClick={() => setLocation(`/groups/${result.groupId}/results?weekOf=${result.weekOf}`)}
            className="w-full text-left bg-card/30 border border-border/20 rounded-xl p-4 flex items-center justify-between hover:border-secondary/30 hover:bg-card/50 transition-all duration-200"
          >
            <div>
              <p className="font-medium text-foreground text-sm">{result.movie}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{result.groupName} · {result.weekOf}</p>
            </div>
            <div className="flex items-center gap-1.5 bg-secondary/10 border border-secondary/20 rounded-lg px-3 py-1.5">
              <Star className="w-3.5 h-3.5 text-secondary fill-secondary/40" />
              <span className="text-secondary font-bold text-sm">{parseFloat(result.averageRating.toFixed(2))}</span>
              <span className="text-muted-foreground text-xs">/ {result.totalVotes} ratings</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
