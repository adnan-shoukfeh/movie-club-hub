import { useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useGetGroup,
  useGetMe,
  getGetGroupQueryKey,
  getGetGroupStatusQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { ArrowLeft, Shield, Menu, Clapperboard, Trophy, Sticker, Plus, ChevronDown, ChevronUp, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserLink } from "@/domains/profiles/components/UserLink";
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
import { InviteCodePanel } from "@/domains/admin/components/InviteCodePanel";
import { StickerGrid } from "@/domains/admin/components/StickerGrid";
import { StickerUploadModal } from "@/domains/admin/components/StickerUploadModal";
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
  const { data: me } = useGetMe();

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [currentTurnWeekOf, setCurrentTurnWeekOf] = useState<string>("");
  const [scheduleReloadKey, setScheduleReloadKey] = useState(0);
  const [stickerUploadOpen, setStickerUploadOpen] = useState(false);
  const [deletingStickerId, setDeletingStickerId] = useState<number | null>(null);

  const { data: stickersData, isLoading: stickersLoading } = useQuery({
    queryKey: ["group-stickers", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/stickers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stickers");
      return res.json() as Promise<{
        globalStickers: Array<{ id: number; name: string; imageUrl: string; isGlobal: boolean }>;
        groupStickers: Array<{ id: number; name: string; imageUrl: string; isGlobal: boolean }>;
      }>;
    },
    enabled: !!groupId,
  });

  const deleteStickerMutation = useMutation({
    mutationFn: async (stickerId: number) => {
      const res = await fetch(`/api/groups/${groupId}/stickers/${stickerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete sticker");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-stickers", groupId] });
      setDeletingStickerId(null);
    },
    onError: () => {
      setDeletingStickerId(null);
    },
  });

  const handleDeleteSticker = (stickerId: number, name: string) => {
    if (!confirm(`Delete sticker "${name}"? This will remove all reactions using this sticker.`)) {
      return;
    }
    setDeletingStickerId(stickerId);
    deleteStickerMutation.mutate(stickerId);
  };

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetGroupStatusQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  }, [queryClient, groupId]);

  const handleScheduleLoaded = useCallback((s: ScheduleEntry[], weekOf: string) => {
    setSchedule(s);
    setCurrentTurnWeekOf(weekOf);
  }, []);

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
          <div className="flex items-center gap-2">
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
                  Back to Group
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/settings")}
              title="Settings"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Settings className="w-4 h-4" />
            </Button>
            {me && (
              <UserLink userId={me.id}>
                <Avatar className="w-8 h-8 border border-border hover:border-primary transition-all cursor-pointer">
                  <AvatarImage src={me.avatarUrl ?? undefined} alt={me.username} />
                  <AvatarFallback className="bg-primary text-secondary text-xs font-black">
                    {me.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </UserLink>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-4">
        <PickerScheduleEditor
          groupId={groupId}
          turnLengthDays={group.turnLengthDays ?? 7}
          isExpanded={activeSection === "schedule"}
          onToggle={() => sectionToggle("schedule")}
          reloadKey={scheduleReloadKey}
          onScheduleLoaded={handleScheduleLoaded}
        />

        <InviteCodePanel
          groupId={groupId}
          isExpanded={activeSection === "invite"}
          onToggle={() => sectionToggle("invite")}
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

        {isAdminOrOwner && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              className="w-full p-4 flex items-center justify-between text-left"
              onClick={() => sectionToggle("stickers")}
            >
              <div className="flex items-center gap-2">
                <Sticker className="w-4 h-4 text-primary" />
                <span className="font-serif font-semibold text-foreground">Group Stickers</span>
              </div>
              {activeSection === "stickers" ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {activeSection === "stickers" && (
              <div className="px-4 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Custom stickers for this group
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setStickerUploadOpen(true)}
                    className="gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Upload
                  </Button>
                </div>

                {stickersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <StickerGrid
                    stickers={stickersData?.groupStickers ?? []}
                    onDelete={handleDeleteSticker}
                    isDeleting={deletingStickerId}
                    emptyMessage="No group stickers yet"
                  />
                )}

                {(stickersData?.globalStickers?.length ?? 0) > 0 && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-3">
                      Global stickers (available to all groups)
                    </p>
                    <StickerGrid
                      stickers={stickersData?.globalStickers ?? []}
                      emptyMessage=""
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <StickerUploadModal
        open={stickerUploadOpen}
        onOpenChange={setStickerUploadOpen}
        groupId={groupId}
        onUploadComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["group-stickers", groupId] });
        }}
      />
    </div>
  );
}
