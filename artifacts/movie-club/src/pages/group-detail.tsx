import {
  useGetGroup,
  useGetGroupStatus,
  useGetMe,
  useAssignPicker,
  useUpdateMemberRole,
  useKickMember,
  useCreateInvite,
  getGetGroupQueryKey,
  getGetGroupStatusQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Trophy,
  Copy,
  Check,
  ChevronDown,
  Shield,
  User,
  Clapperboard,
  Plus,
  Users,
  Eye,
  BookOpen,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatShortDateET } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TurnStatusBanner } from "@/domains/turns/components/TurnStatusBanner";
import { getTurnIndexForDate, getTurnStartDate, normalizeWeekOf } from "@/domains/turns/turnUtils";
import { CurrentTurnMovie } from "@/domains/movies/components/CurrentTurnMovie";
import { PickerMovieSelector } from "@/domains/movies/components/PickerMovieSelector";
import { NominationSheet } from "@/domains/nominations/components/NominationSheet";
import { VerdictForm } from "@/domains/verdicts/components/VerdictForm";
import { VerdictList } from "@/domains/verdicts/components/VerdictList";

export default function GroupDetail() {
  const params = useParams<{ groupId: string }>();
  const groupId = parseInt(params.groupId ?? "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedWeek, setSelectedWeek] = useState("");

  const [showMovieInput, setShowMovieInput] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showMemberActions, setShowMemberActions] = useState<number | null>(null);

  // Sheet open state
  const [pickerScheduleOpen, setPickerScheduleOpen] = useState(false);
  const [nominationsOpen, setNominationsOpen] = useState(false);

  const { data: group, isLoading } = useGetGroup(
    groupId,
    { weekOf: selectedWeek },
    { query: { queryKey: [...getGetGroupQueryKey(groupId), selectedWeek], enabled: !!groupId } }
  );

  const { data: status } = useGetGroupStatus(
    groupId,
    { weekOf: selectedWeek },
    { query: { queryKey: [...getGetGroupStatusQueryKey(groupId), selectedWeek], enabled: !!groupId } }
  );

  const { data: me } = useGetMe();

  useEffect(() => {
    if (group?.currentTurnWeekOf && selectedWeek === "") {
      setSelectedWeek(group.currentTurnWeekOf);
    }
  }, [group?.currentTurnWeekOf, selectedWeek]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetGroupStatusQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  }, [queryClient, groupId]);

  const assignPicker = useAssignPicker();
  const updateRole = useUpdateMemberRole();
  const kickMember = useKickMember();
  const createInvite = useCreateInvite();

  const handleAssignPicker = (userId: number) => {
    assignPicker.mutate(
      { groupId, data: { userId } },
      {
        onSuccess: () => {
          toast({ title: "Picker assigned!" });
          setShowMemberActions(null);
          invalidate();
        },
        onError: (e: any) => {
          toast({ title: "Error", description: e.data?.error, variant: "destructive" });
        },
      }
    );
  };

  const handleKick = (userId: number) => {
    if (!confirm("Remove this member?")) return;
    kickMember.mutate(
      { groupId, data: { userId } },
      {
        onSuccess: () => {
          toast({ title: "Member removed" });
          setShowMemberActions(null);
          invalidate();
        },
        onError: (e: any) => {
          toast({ title: "Error", description: e.data?.error, variant: "destructive" });
        },
      }
    );
  };

  const handleUpdateRole = (userId: number, role: string) => {
    updateRole.mutate(
      { groupId, data: { userId, role } },
      {
        onSuccess: () => {
          toast({ title: `Role updated to ${role}` });
          setShowMemberActions(null);
          invalidate();
        },
        onError: (e: any) => {
          toast({ title: "Error", description: e.data?.error, variant: "destructive" });
        },
      }
    );
  };

  const handleCreateInvite = () => {
    createInvite.mutate(
      { groupId, data: {} },
      {
        onSuccess: (invite) => setShowInviteCode(invite.code),
        onError: (e: any) => {
          toast({ title: "Error", description: e.data?.error, variant: "destructive" });
        },
      }
    );
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Group not found</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isAdminOrOwner = group.myRole === "owner" || group.myRole === "admin";
  const currentTurnWeekOf = group.currentTurnWeekOf as string;
  const isCurrentWeek = normalizeWeekOf(selectedWeek) === normalizeWeekOf(currentTurnWeekOf);
  const movie = group.movieData;
  const watchedCount = group.members.filter((m) => m.watched).length;
  const pickerSchedule = group.pickerSchedule;

  const _config = group.turnConfig;
  const _currentIdx = getTurnIndexForDate(currentTurnWeekOf, _config);
  const nextTurnWeekOf = getTurnStartDate(_currentIdx + 1, _config);
  const isPickerForSelectedTurn = group.pickerUserId === me?.id;
  const canEditMovie = isAdminOrOwner
    || (!!group.movieUnlockedByAdmin && isPickerForSelectedTurn)
    || (normalizeWeekOf(selectedWeek) === normalizeWeekOf(nextTurnWeekOf) && isPickerForSelectedTurn);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-serif font-bold text-foreground">{group.name}</h1>
              <span className="text-xs text-muted-foreground capitalize">{group.myRole}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {group.resultsAvailable && movie && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocation(`/groups/${groupId}/results?weekOf=${selectedWeek}`)}
                className="border-secondary/30 text-secondary hover:bg-secondary/10"
              >
                <Trophy className="w-3.5 h-3.5 mr-1.5" />
                Results
              </Button>
            )}
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
                <DropdownMenuItem onClick={() => setPickerScheduleOpen(true)}>
                  <Clapperboard className="w-4 h-4 mr-2" />
                  Picker Schedule
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNominationsOpen(true)}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Nominations Pool
                </DropdownMenuItem>
                {isAdminOrOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation(`/groups/${groupId}/admin`)}>
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Panel
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-5">

        <TurnStatusBanner
          group={group}
          selectedWeek={selectedWeek}
          onWeekChange={setSelectedWeek}
        />

        {showMovieInput ? (
          <div className="bg-card/50 border border-border/30 rounded-xl p-5">
            <PickerMovieSelector
              groupId={groupId}
              selectedWeek={selectedWeek}
              onCancel={() => setShowMovieInput(false)}
              onSuccess={() => setShowMovieInput(false)}
            />
          </div>
        ) : (
          <CurrentTurnMovie
            group={group}
            status={status}
            selectedWeek={selectedWeek}
            canEditMovie={canEditMovie}
            onEditMovie={() => setShowMovieInput(true)}
          />
        )}

        {status?.votingOpen && movie && (
          <VerdictForm
            group={group}
            status={status}
            groupId={groupId}
            selectedWeek={selectedWeek}
          />
        )}

        <VerdictList
          groupId={groupId}
          group={group}
          status={status}
          selectedWeek={selectedWeek}
        />

        {/* Controls: admin sees Generate Invite only; members see Join via Code only */}
        {isCurrentWeek && (
          <div className="bg-card/50 border border-border/30 rounded-xl p-5">
            {isAdminOrOwner ? (
              <>
                <h2 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Admin Controls
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateInvite}
                  disabled={createInvite.isPending}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Generate Invite
                </Button>
                {showInviteCode && (
                  <div className="mt-3 flex items-center gap-2 bg-background/50 border border-border/30 rounded-lg p-3">
                    <code className="text-primary font-mono text-sm flex-1 tracking-widest">{showInviteCode}</code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => copyCode(showInviteCode)}
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Actions
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation("/join")}
                >
                  Join via Code
                </Button>
              </>
            )}
          </div>
        )}

        {/* Members */}
        <div className="bg-card/50 border border-border/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Members ({group.members.length})
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              {watchedCount}/{group.members.length} watched
            </div>
          </div>

          <div className="space-y-2">
            {group.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-2 border-b border-border/10 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">{member.username}</span>
                    {status?.pickerUserId === member.id && (
                      <span className="ml-2 text-xs text-secondary">
                        <Clapperboard className="w-3 h-3 inline mr-0.5" />
                        Picker
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      member.watched
                        ? "bg-green-500/15 text-green-400 border border-green-500/20"
                        : "bg-muted/40 text-muted-foreground border border-border/30"
                    }`}
                  >
                    {member.watched ? "Watched" : "Not Yet"}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs capitalize ${
                      member.role === "owner"
                        ? "border-primary/40 text-primary"
                        : member.role === "admin"
                        ? "border-secondary/40 text-secondary"
                        : "border-border/40 text-muted-foreground"
                    }`}
                  >
                    {member.role}
                  </Badge>
                  {isAdminOrOwner && member.role !== "owner" && (
                    <div className="relative">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setShowMemberActions(showMemberActions === member.id ? null : member.id)}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                      {showMemberActions === member.id && (
                        <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl z-20 min-w-36 py-1">
                          <button
                            className="w-full text-left text-xs px-3 py-2 text-foreground hover:bg-muted transition-colors"
                            onClick={() => handleAssignPicker(member.id)}
                          >
                            Make Picker
                          </button>
                          {member.role !== "admin" && (
                            <button
                              className="w-full text-left text-xs px-3 py-2 text-foreground hover:bg-muted transition-colors"
                              onClick={() => handleUpdateRole(member.id, "admin")}
                            >
                              Promote to Admin
                            </button>
                          )}
                          {member.role === "admin" && (
                            <button
                              className="w-full text-left text-xs px-3 py-2 text-foreground hover:bg-muted transition-colors"
                              onClick={() => handleUpdateRole(member.id, "member")}
                            >
                              Demote to Member
                            </button>
                          )}
                          <button
                            className="w-full text-left text-xs px-3 py-2 text-destructive hover:bg-muted transition-colors"
                            onClick={() => handleKick(member.id)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Picker Schedule Sheet */}
      <Sheet open={pickerScheduleOpen} onOpenChange={setPickerScheduleOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle className="font-serif flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" />
              Picker Schedule
            </SheetTitle>
          </SheetHeader>
          {pickerSchedule && pickerSchedule.length > 0 ? (
            <div className="space-y-1.5">
              {pickerSchedule.map((slot) => {
                const isPast = normalizeWeekOf(slot.weekOf) < normalizeWeekOf(currentTurnWeekOf);
                return (
                  <div
                    key={slot.weekOf}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                      slot.isCurrent
                        ? "bg-primary/10 border border-primary/25"
                        : isPast
                        ? "bg-muted/10 border border-border/10 opacity-50"
                        : "bg-muted/20 border border-border/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {slot.isCurrent && (
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Now</span>
                      )}
                      {isPast && !slot.isCurrent && (
                        <span className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wide">Done</span>
                      )}
                      <span className={`text-sm ${slot.isCurrent ? "text-foreground font-medium" : isPast ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                        {formatShortDateET(slot.weekOf)} – {formatShortDateET(slot.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {slot.pickerUsername ? (
                        <>
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-3 h-3 text-muted-foreground" />
                          </div>
                          <span className={`text-sm ${slot.isCurrent ? "text-foreground font-medium" : isPast ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                            {slot.pickerUsername}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">Unassigned</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/60 italic text-center py-6">No schedule available.</p>
          )}
        </SheetContent>
      </Sheet>

      <NominationSheet
        groupId={groupId}
        isOpen={nominationsOpen}
        onOpenChange={setNominationsOpen}
        isAdminOrOwner={isAdminOrOwner}
        watchedMovieImdbId={group.movieData?.imdbId}
        resultsAvailable={group.resultsAvailable}
      />
    </div>
  );
}
