import { useGetDashboard, useGetMe, useLogout, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupList } from "@/domains/groups/components/GroupList";
import { DashboardStats } from "@/domains/groups/components/DashboardStats";
import { DashboardHeader } from "@/domains/groups/components/DashboardHeader";
import { RecentVerdictsList } from "@/domains/verdicts/components/RecentVerdictsList";
import { VHSNoise } from "@/components/ui/vhs-noise";

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
        <VHSNoise />
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <GroupList groups={undefined} isLoading={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <VHSNoise />
      <DashboardHeader
        username={me?.username}
        onProfile={() => setLocation("/profile")}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {dashboard && <DashboardStats totalGroups={dashboard.totalGroups} pendingVotes={dashboard.pendingVotes} pastResults={dashboard.recentResults.length} />}

        {/* Groups Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="bg-primary px-6 py-3 border-4 border-secondary inline-flex items-center gap-3">
            <h2 className="text-xl font-black text-secondary uppercase tracking-wide">Your Clubs</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/join")}
              className="px-4 py-2 bg-secondary text-white border-2 border-white/30 hover:border-primary hover:text-primary transition-all font-bold uppercase text-sm"
            >
              Join
            </button>
            <button
              onClick={() => setLocation("/groups/new")}
              className="px-4 py-2 bg-primary text-secondary border-2 border-secondary hover:bg-secondary hover:text-primary hover:border-primary transition-all font-bold uppercase text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Club
            </button>
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
