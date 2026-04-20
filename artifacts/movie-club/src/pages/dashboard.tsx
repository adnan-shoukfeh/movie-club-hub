import { useGetDashboard, useGetMe, useLogout, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupList } from "@/domains/groups/components/GroupList";
import { DashboardStats } from "@/domains/groups/components/DashboardStats";
import { DashboardHeader } from "@/domains/groups/components/DashboardHeader";
import { RecentVerdictsList } from "@/domains/verdicts/components/RecentVerdictsList";

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
          <GroupList groups={undefined} isLoading={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        username={me?.username}
        onProfile={() => setLocation("/profile")}
        onLogout={handleLogout}
      />

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Stats */}
        {dashboard && <DashboardStats totalGroups={dashboard.totalGroups} pendingVotes={dashboard.pendingVotes} pastResults={dashboard.recentResults.length} />}

        {/* Groups */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">Your Clubs</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setLocation("/join")}>Join</Button>
            <Button size="sm" onClick={() => setLocation("/groups/new")} className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-1.5" />
              New Club
            </Button>
          </div>
        </div>

        <GroupList groups={dashboard?.groups} isLoading={false} />

        {dashboard?.recentResults && (
          <RecentVerdictsList results={dashboard.recentResults} />
        )}
      </main>
    </div>
  );
}
