import { useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetGroup,
  getGetGroupQueryKey,
  getGetGroupStatusQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { ArrowLeft, Shield, Menu, Clapperboard, BookOpen, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PickerScheduleEditor } from "@/domains/admin/components/PickerScheduleEditor";
import { VerdictOverridePanel } from "@/domains/admin/components/VerdictOverridePanel";
import { MemberRoleManager } from "@/domains/admin/components/MemberRoleManager";
import { GroupSettingsForm } from "@/domains/admin/components/GroupSettingsForm";
import type { ScheduleEntry } from "@/domains/admin/components/shared";

export default function GroupAdmin() {
  const params = useParams<{ groupId: string }>();
  const groupId = parseInt(params.groupId ?? "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: group, isLoading } = useGetGroup(
    groupId,
    {},
    { query: { queryKey: getGetGroupQueryKey(groupId), enabled: !!groupId } }
  );

  const [activeSection, setActiveSection] = useState<string | null>("schedule");
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [currentTurnWeekOf, setCurrentTurnWeekOf] = useState<string>("");
  const [scheduleReloadKey, setScheduleReloadKey] = useState(0);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetGroupStatusQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  }, [queryClient, groupId]);

  useEffect(() => {
    if (group && group.myRole !== "owner" && group.myRole !== "admin") {
      setLocation(`/groups/${groupId}`);
    }
  }, [group, groupId, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Group not found</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/dashboard")}>Back</Button>
        </div>
      </div>
    );
  }

  const isOwner = group.myRole === "owner";
  const isAdminOrOwner = group.myRole === "owner" || group.myRole === "admin";

  if (!isAdminOrOwner) return null;

  const sectionToggle = (key: string) => setActiveSection(activeSection === key ? null : key);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/groups/${groupId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-serif font-bold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Admin Panel
              </h1>
              <span className="text-xs text-muted-foreground">{group.name}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-muted-foreground"
              >
                <Menu className="w-4 h-4" />
                Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setLocation(`/groups/${groupId}`)}>
                <Clapperboard className="w-4 h-4 mr-2" />
                Picker Schedule
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation(`/groups/${groupId}`)}>
                <BookOpen className="w-4 h-4 mr-2" />
                Nominations Pool
              </DropdownMenuItem>
              {group.resultsAvailable && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation(`/groups/${groupId}/results`)}>
                    <Trophy className="w-4 h-4 mr-2" />
                    Results
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-4">
        <PickerScheduleEditor
          groupId={groupId}
          turnLengthDays={group.turnLengthDays ?? 7}
          isExpanded={activeSection === "schedule"}
          onToggle={() => sectionToggle("schedule")}
          reloadKey={scheduleReloadKey}
          onScheduleLoaded={(s, weekOf) => {
            setSchedule(s);
            setCurrentTurnWeekOf(weekOf);
          }}
        />

        <VerdictOverridePanel
          groupId={groupId}
          schedule={schedule}
          currentTurnWeekOf={currentTurnWeekOf}
          isExpanded={activeSection === "votes"}
          onToggle={() => sectionToggle("votes")}
        />

        <MemberRoleManager
          groupId={groupId}
          members={group.members}
          isOwner={isOwner}
          isExpanded={activeSection === "roles"}
          onToggle={() => sectionToggle("roles")}
          onMutate={invalidate}
        />

        {isAdminOrOwner && (
          <GroupSettingsForm
            groupId={groupId}
            initialStartDate={group.startDate ?? ""}
            initialTurnLengthDays={group.turnLengthDays ?? 7}
            isExpanded={activeSection === "settings"}
            onToggle={() => sectionToggle("settings")}
            onMutate={() => {
              invalidate();
              setScheduleReloadKey((k) => k + 1);
            }}
          />
        )}
      </main>
    </div>
  );
}
