interface DashboardStatsProps {
  totalGroups: number;
  pendingVotes: number;
  pastResults: number;
}

export function DashboardStats({ totalGroups, pendingVotes, pastResults }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <div className="bg-card/50 border border-border/30 rounded-xl p-4 text-center">
        <div className="text-2xl font-serif font-bold text-foreground">{totalGroups}</div>
        <div className="text-xs text-muted-foreground mt-1">Clubs</div>
      </div>
      <div className="bg-card/50 border border-border/30 rounded-xl p-4 text-center">
        <div className={`text-2xl font-serif font-bold ${pendingVotes > 0 ? "text-primary" : "text-foreground"}`}>
          {pendingVotes}
        </div>
        <div className="text-xs text-muted-foreground mt-1">Pending ratings</div>
      </div>
      <div className="bg-card/50 border border-border/30 rounded-xl p-4 text-center">
        <div className="text-2xl font-serif font-bold text-foreground">{pastResults}</div>
        <div className="text-xs text-muted-foreground mt-1">Past results</div>
      </div>
    </div>
  );
}
