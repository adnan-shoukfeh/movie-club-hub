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
  Copy,
  Check,
  ChevronDown,
  Shield,
  User,
  Clapperboard,
  Plus,
  Users,
  Clock,
  BookOpen,
  Calendar,
  Lightbulb,
  Settings,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatShortDateET } from "@/lib/utils";
import { TurnStatusBanner } from "@/domains/turns/components/TurnStatusBanner";
import { getTurnIndexForDate, getTurnStartDate, normalizeWeekOf } from "@/domains/turns/turnUtils";
import { CurrentTurnMovie } from "@/domains/movies/components/CurrentTurnMovie";
import { PickerMovieSelector } from "@/domains/movies/components/PickerMovieSelector";
import { NominationSheet } from "@/domains/nominations/components/NominationSheet";
import { VerdictForm } from "@/domains/verdicts/components/VerdictForm";
import { VerdictList } from "@/domains/verdicts/components/VerdictList";
import { VHSNoise } from "@/components/ui/vhs-noise";

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
      <div className="min-h-screen bg-background p-6 relative">
        <VHSNoise />
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        <VHSNoise />
        <div className="text-center border-4 border-secondary bg-card p-12">
          <p className="text-white font-bold uppercase mb-4">Group not found</p>
          <button
            onClick={() => setLocation("/dashboard")}
            className="px-6 py-3 bg-primary text-secondary border-4 border-secondary hover:bg-secondary hover:text-primary hover:border-primary transition-all font-black uppercase"
          >
            Back to Dashboard
          </button>
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
    <div className="min-h-screen bg-background flex relative">
      <VHSNoise />
      <div className="flex-1 flex flex-col">
        <header className="border-b-4 border-primary sticky top-0 z-20 bg-secondary">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 mr-2">
              <button
                onClick={() => setLocation("/dashboard")}
                className="text-white hover:text-primary transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="font-black text-primary uppercase truncate text-sm sm:text-2xl">{group.name}</h1>
                <p className="text-xs sm:text-sm text-white/80 capitalize">{group.myRole}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => setPickerScheduleOpen(true)}
                className={`p-2 sm:p-2.5 border-2 transition-all ${
                  pickerScheduleOpen
                    ? "bg-primary text-secondary border-primary"
                    : "bg-secondary text-white border-white/30 hover:border-primary"
                }`}
              >
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setNominationsOpen(true)}
                className={`p-2 sm:p-2.5 border-2 transition-all ${
                  nominationsOpen
                    ? "bg-primary text-secondary border-primary"
                    : "bg-secondary text-white border-white/30 hover:border-primary"
                }`}
              >
                <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              {isAdminOrOwner && (
                <button
                  onClick={() => setLocation(`/groups/${groupId}/admin`)}
                  className="p-2 sm:p-2.5 border-2 border-white/30 hover:border-primary bg-secondary text-white hover:text-primary transition-all"
                >
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
              {canEditMovie && (
                <button
                  onClick={() => setShowMovieInput(true)}
                  className="p-2 sm:px-4 sm:py-2 bg-primary text-secondary border-2 border-secondary hover:bg-secondary hover:text-primary hover:border-primary transition-all font-black uppercase text-sm"
                >
                  <Clapperboard className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Select Movie</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-5xl mx-auto relative">

        <TurnStatusBanner
          group={group}
          selectedWeek={selectedWeek}
          onWeekChange={setSelectedWeek}
        />

        {showMovieInput ? (
          <div className="border-4 border-secondary bg-card p-6 mb-8">
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

        {/* Admin Controls */}
        {isCurrentWeek && isAdminOrOwner && (
          <div className="border-4 border-secondary bg-card p-6 mb-6">
            <h3 className="font-black text-primary mb-4 text-xl flex items-center gap-2 uppercase">
              <Shield className="w-6 h-6" />
              Admin Controls
            </h3>
            <button
              onClick={handleCreateInvite}
              disabled={createInvite.isPending}
              className="px-4 py-2 bg-primary text-secondary border-4 border-secondary hover:bg-secondary hover:text-primary hover:border-primary transition-all font-black uppercase text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Generate Invite
            </button>
            {showInviteCode && (
              <div className="mt-4 flex items-center gap-3 bg-secondary border-4 border-primary p-4">
                <code className="text-primary font-mono text-lg flex-1 tracking-widest font-bold">{showInviteCode}</code>
                <button
                  onClick={() => copyCode(showInviteCode)}
                  className="p-2 bg-primary text-secondary hover:bg-card hover:text-primary transition-all"
                >
                  {copiedCode ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Watch Status / Members */}
        <div className="p-6 mb-6">
          <h3 className="font-black text-primary mb-4 text-xl flex items-center gap-2 uppercase">
            <User className="w-6 h-6" />
            Watch Status
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {group.members.map((member) => {
              const watched = member.watched;
              const isPicker = status?.pickerUserId === member.id;

              return (
                <div key={member.id} className="p-3 bg-secondary border-2 border-white/20 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-primary flex items-center justify-center">
                      <User className="w-5 h-5 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{member.username}</p>
                      {isPicker && (
                        <span className="text-xs text-primary font-bold uppercase">Picker</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {watched ? (
                      <div className="flex items-center gap-1 text-primary font-bold">
                        <Check className="w-3 h-3" />
                        Watched
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-white/50 font-bold">
                        <Clock className="w-3 h-3" />
                        Pending
                      </div>
                    )}
                  </div>
                  {/* Admin actions */}
                  {isAdminOrOwner && member.role !== "owner" && (
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={() => setShowMemberActions(showMemberActions === member.id ? null : member.id)}
                        className="p-1 text-white/50 hover:text-primary transition-colors"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {showMemberActions === member.id && (
                        <div className="absolute right-0 top-full mt-1 bg-card border-4 border-secondary shadow-xl z-20 min-w-36">
                          <button
                            className="w-full text-left text-xs px-3 py-2 text-white hover:bg-secondary font-bold uppercase transition-colors"
                            onClick={() => handleAssignPicker(member.id)}
                          >
                            Make Picker
                          </button>
                          {member.role !== "admin" && (
                            <button
                              className="w-full text-left text-xs px-3 py-2 text-white hover:bg-secondary font-bold uppercase transition-colors"
                              onClick={() => handleUpdateRole(member.id, "admin")}
                            >
                              Promote
                            </button>
                          )}
                          {member.role === "admin" && (
                            <button
                              className="w-full text-left text-xs px-3 py-2 text-white hover:bg-secondary font-bold uppercase transition-colors"
                              onClick={() => handleUpdateRole(member.id, "member")}
                            >
                              Demote
                            </button>
                          )}
                          <button
                            className="w-full text-left text-xs px-3 py-2 text-destructive hover:bg-secondary font-bold uppercase transition-colors"
                            onClick={() => handleKick(member.id)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
          </div>
        </main>
      </div>

      {/* Picker Schedule Sidebar */}
      {pickerScheduleOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/80 z-30 lg:hidden"
            onClick={() => setPickerScheduleOpen(false)}
          />
          <div className="fixed lg:relative right-0 top-0 bottom-0 w-80 lg:w-96 bg-card border-l-8 border-primary z-40 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b-4 border-secondary">
                <h3 className="font-black text-primary text-xl uppercase">
                  Picker Schedule
                </h3>
                <button
                  onClick={() => setPickerScheduleOpen(false)}
                  className="p-1 hover:bg-secondary text-white lg:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {pickerSchedule && pickerSchedule.length > 0 ? (
                <div className="space-y-3">
                  {pickerSchedule.map((slot) => {
                    const isPast = normalizeWeekOf(slot.weekOf) < normalizeWeekOf(currentTurnWeekOf);
                    return (
                      <div
                        key={slot.weekOf}
                        className={`p-4 border-4 transition-all ${
                          slot.isCurrent
                            ? "border-primary bg-secondary"
                            : "border-secondary bg-card"
                        } ${isPast ? "opacity-50" : ""}`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-primary flex items-center justify-center text-secondary font-black text-lg">
                            {pickerSchedule.indexOf(slot) + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-white/60 font-bold">
                              {formatShortDateET(slot.weekOf)} – {formatShortDateET(slot.endDate)}
                            </p>
                            {slot.isCurrent && (
                              <span className="text-xs font-black text-primary uppercase">Current</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t-2 border-white/20">
                          <div className="w-8 h-8 bg-primary flex items-center justify-center">
                            <User className="w-4 h-4 text-secondary" />
                          </div>
                          <span className="text-sm font-bold text-white">
                            {slot.pickerUsername ?? "Unassigned"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 border-4 border-secondary bg-card">
                  <Clapperboard className="w-12 h-12 text-secondary mx-auto mb-3" />
                  <p className="text-white text-sm font-bold">No schedule available</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

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
