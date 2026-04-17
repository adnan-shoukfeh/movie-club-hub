import { useGetDashboard, useGetMe, useLogout, getGetMeQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Film, Plus, LogOut, Users, Star, Clock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function GroupCard({ group, onClick }: { group: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border/50 rounded-xl p-5 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
            {group.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground capitalize">{group.role}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {group.memberCount}
            </span>
          </div>
        </div>
        <div>
          {group.votingOpen && !group.hasVoted && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Rating open</Badge>
          )}
          {group.hasVoted && group.votingOpen && (
            <Badge variant="outline" className="text-xs text-muted-foreground">Rated</Badge>
          )}
          {group.resultsAvailable && (
            <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs">Results in</Badge>
          )}
        </div>
      </div>

      {group.currentMovie ? (
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-primary/70 shrink-0" />
          <span className="text-sm text-foreground/80 truncate">{group.currentMovie}</span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No movie set this week</p>
      )}
    </button>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: dashboard, isLoading: dashLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() }
  });
  const logoutMutation = useLogout();

  useEffect(() => {
    if (!meLoading && !me) {
      setLocation("/");
    }
  }, [me, meLoading, setLocation]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/");
      },
    });
  };

  if (meLoading || dashLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Film className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="font-serif font-semibold text-foreground">Movie Club</span>
              {me && (
                <span className="text-muted-foreground text-sm ml-2">· {me.username}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/profile")}
              className="text-muted-foreground hover:text-foreground"
              title="Profile settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Stats */}
        {dashboard && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-card/50 border border-border/30 rounded-xl p-4 text-center">
              <div className="text-2xl font-serif font-bold text-foreground">{dashboard.totalGroups}</div>
              <div className="text-xs text-muted-foreground mt-1">Clubs</div>
            </div>
            <div className="bg-card/50 border border-border/30 rounded-xl p-4 text-center">
              <div className={`text-2xl font-serif font-bold ${dashboard.pendingVotes > 0 ? "text-primary" : "text-foreground"}`}>
                {dashboard.pendingVotes}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Pending ratings</div>
            </div>
            <div className="bg-card/50 border border-border/30 rounded-xl p-4 text-center">
              <div className="text-2xl font-serif font-bold text-foreground">
                {dashboard.recentResults.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Past results</div>
            </div>
          </div>
        )}

        {/* Groups */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">Your Clubs</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLocation("/join")}
            >
              Join
            </Button>
            <Button
              size="sm"
              onClick={() => setLocation("/groups/new")}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Club
            </Button>
          </div>
        </div>

        {dashboard?.groups && dashboard.groups.length > 0 ? (
          <div className="grid gap-3 mb-10">
            {dashboard.groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onClick={() => setLocation(`/groups/${group.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-card/30 border border-border/20 rounded-xl p-12 text-center mb-10">
            <Film className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-2">No clubs yet</p>
            <p className="text-muted-foreground/60 text-sm mb-6">Create a club or join one with an invite code.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setLocation("/groups/new")} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-1.5" />
                Create a Club
              </Button>
              <Button variant="outline" onClick={() => setLocation("/join")}>
                Join with Code
              </Button>
            </div>
          </div>
        )}

        {/* Recent Results */}
        {dashboard?.recentResults && dashboard.recentResults.length > 0 && (
          <div>
            <h2 className="font-serif text-xl font-semibold text-foreground mb-4">Recent Results</h2>
            <div className="grid gap-3">
              {dashboard.recentResults.map((result, i) => (
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
        )}
      </main>
    </div>
  );
}
