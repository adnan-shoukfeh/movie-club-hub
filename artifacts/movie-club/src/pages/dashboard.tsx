import { useGetDashboard, useGetMe, useLogout, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronDown, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupList } from "@/domains/groups/components/GroupList";
import { DashboardHeader } from "@/domains/groups/components/DashboardHeader";
import { RecentVerdictsList } from "@/domains/verdicts/components/RecentVerdictsList";
import { VHSNoise } from "@/components/ui/vhs-noise";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        {/* Groups Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="bg-primary px-6 py-3 border-4 border-secondary inline-flex items-center gap-3">
            <h2 className="text-xl font-black text-secondary uppercase tracking-wide">
              Your Clubs
              {dashboard && (
                <span className="ml-2 text-secondary/70">({dashboard.totalGroups})</span>
              )}
            </h2>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-4 py-2 bg-primary text-secondary border-2 border-secondary hover:bg-secondary hover:text-primary hover:border-primary transition-all font-bold uppercase text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Club
                <ChevronDown className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-secondary border-2 border-primary">
              <DropdownMenuItem
                onClick={() => setLocation("/join")}
                className="font-bold uppercase text-sm cursor-pointer hover:bg-primary hover:text-secondary"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Join Existing
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setLocation("/groups/new")}
                className="font-bold uppercase text-sm cursor-pointer hover:bg-primary hover:text-secondary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <GroupList groups={dashboard?.groups} isLoading={false} />

        {dashboard?.recentResults && (
          <RecentVerdictsList results={dashboard.recentResults} />
        )}
      </main>
    </div>
  );
}
