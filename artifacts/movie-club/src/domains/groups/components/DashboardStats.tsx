import { Film, Star, Trophy } from "lucide-react";

interface DashboardStatsProps {
  totalGroups: number;
  pendingVotes: number;
  pastResults: number;
}

export function DashboardStats({ totalGroups, pendingVotes, pastResults }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <div className="bg-card border-4 border-secondary p-4 text-center">
        <Film className="w-6 h-6 text-primary mx-auto mb-2" />
        <div className="text-3xl font-black text-white">{totalGroups}</div>
        <div className="text-xs text-white/60 mt-1 uppercase font-bold tracking-wider">Clubs</div>
      </div>
      <div className={`bg-card border-4 p-4 text-center ${pendingVotes > 0 ? "border-primary" : "border-secondary"}`}>
        <Star className={`w-6 h-6 mx-auto mb-2 ${pendingVotes > 0 ? "text-primary fill-primary" : "text-secondary"}`} />
        <div className={`text-3xl font-black ${pendingVotes > 0 ? "text-primary" : "text-white"}`}>
          {pendingVotes}
        </div>
        <div className="text-xs text-white/60 mt-1 uppercase font-bold tracking-wider">To Rate</div>
      </div>
      <div className="bg-card border-4 border-secondary p-4 text-center">
        <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
        <div className="text-3xl font-black text-white">{pastResults}</div>
        <div className="text-xs text-white/60 mt-1 uppercase font-bold tracking-wider">Results</div>
      </div>
    </div>
  );
}
