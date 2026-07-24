import {
  useGetGroup,
  useGetGroupStatus,
  useGetMe,
  useAssignPicker,
  useUpdateMemberRole,
  useKickMember,
  getGetGroupQueryKey,
  getGetGroupStatusQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useLocation, useParams, useSearch } from "wouter";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  ArrowLeft,
  User,
  Clapperboard,
  Calendar,
  Lightbulb,
  LayoutList,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { formatShortDateET } from "@/lib/utils";
import { WeeklyShowingsCarousel } from "@/domains/turns/components/WeeklyShowingsCarousel";
import { normalizeWeekOf } from "@/domains/turns/turnUtils";
import { CurrentTurnMovie } from "@/domains/movies/components/CurrentTurnMovie";
import { PickerMovieSelector } from "@/domains/movies/components/PickerMovieSelector";
import { NominationSheet } from "@/domains/nominations/components/NominationSheet";
import { VerdictForm } from "@/domains/verdicts/components/VerdictForm";
import { TurnResultsInline } from "@/domains/verdicts/components/TurnResultsInline";
import { VHSNoise } from "@/components/ui/vhs-noise";
import { UserLink } from "@/domains/profiles/components/UserLink";
import {
  CinemaLoadingDeck,
  CinemaRouteCurtain,
} from "@/components/cinema/cinema-effects";
import { WatchStatusShelf } from "@/domains/members/components/WatchStatusShelf";

export default function GroupDetail() {
  const params = useParams<{ groupId: string }>();
  const groupId = parseInt(params.groupId ?? "0", 10);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const prefersReducedMotionRef = useRef(
    typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [entryMinimumElapsed, setEntryMinimumElapsed] = useState(
    prefersReducedMotionRef.current,
  );
  const [entryPhase, setEntryPhase] = useState<
    "holding" | "leaving" | "hidden"
  >(prefersReducedMotionRef.current ? "hidden" : "holding");
  const [isExiting, setIsExiting] = useState(false);
  const entryHideTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  // Read weekOf from URL query param if present
  const initialWeekOf = new URLSearchParams(search).get("weekOf") ?? "";
  const [selectedWeek, setSelectedWeek] = useState(initialWeekOf);
  const navigationLockRef = useRef(false);
  // +1 = moving to a later turn, -1 = earlier. Drives the slide direction.
  const [navDirection, setNavDirection] = useState(0);
  const handleWeekChange = useCallback(
    (week: string, directionOverride?: -1 | 0 | 1) => {
      if (!week || navigationLockRef.current) return;
      navigationLockRef.current = true;
      setNavDirection(
        directionOverride ??
          (normalizeWeekOf(week) >= normalizeWeekOf(selectedWeek) ? 1 : -1),
      );
      setSelectedWeek(week);
    },
    [selectedWeek],
  );

  const [showMovieInput, setShowMovieInput] = useState(false);
  // Sheet open state
  const [pickerScheduleOpen, setPickerScheduleOpen] = useState(false);
  const [nominationsOpen, setNominationsOpen] = useState(false);

  const { data: group, isLoading, isPlaceholderData, isError: isGroupError } = useGetGroup(
    groupId,
    { weekOf: selectedWeek },
    {
      query: {
        queryKey: [...getGetGroupQueryKey(groupId), selectedWeek],
        enabled: !!groupId,
        // Keep the previous week's data on screen while the next one loads, so
        // stepping between turns never drops to the loading skeleton (no flash).
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
      },
    }
  );

  const { data: status, isError: isStatusError } = useGetGroupStatus(
    groupId,
    { weekOf: selectedWeek },
    {
      query: {
        queryKey: [...getGetGroupStatusQueryKey(groupId), selectedWeek],
        enabled: !!groupId,
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
      },
    }
  );

  const { data: me } = useGetMe();

  useEffect(() => {
    if (prefersReducedMotionRef.current) return;
    const timer = window.setTimeout(() => setEntryMinimumElapsed(true), 680);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (
      prefersReducedMotionRef.current
      || isLoading
      || !entryMinimumElapsed
      || entryPhase !== "holding"
    ) {
      return;
    }

    setEntryPhase("leaving");
    entryHideTimerRef.current = window.setTimeout(
      () => setEntryPhase("hidden"),
      420,
    );
  }, [entryMinimumElapsed, entryPhase, isLoading]);

  useEffect(
    () => () => {
      if (entryHideTimerRef.current !== null) {
        window.clearTimeout(entryHideTimerRef.current);
      }
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    },
    [],
  );

  const exitToDashboard = useCallback(() => {
    if (isExiting) return;
    if (prefersReducedMotionRef.current) {
      setLocation("/dashboard");
      return;
    }

    setEntryPhase("hidden");
    setIsExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      setLocation("/dashboard");
    }, 440);
  }, [isExiting, setLocation]);

  useEffect(() => {
    if (group?.currentTurnWeekOf && selectedWeek === "" && !initialWeekOf) {
      setSelectedWeek(group.currentTurnWeekOf);
    }
  }, [group?.currentTurnWeekOf, selectedWeek, initialWeekOf]);

  // Re-sync the selected week to whatever the server actually served (it clamps
  // future weeks back to the current turn). Skip while data is a placeholder from
  // keepPreviousData — that's the previous week's data still on screen during an
  // in-flight fetch, and snapping to it would cancel the navigation.
  useEffect(() => {
    if (isPlaceholderData) return;
    if (group?.weekOf && selectedWeek && normalizeWeekOf(selectedWeek) !== normalizeWeekOf(group.weekOf)) {
      setSelectedWeek(group.weekOf);
      return;
    }
    navigationLockRef.current = false;
  }, [group?.weekOf, selectedWeek, isPlaceholderData]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetGroupStatusQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  }, [queryClient, groupId]);

  const assignPicker = useAssignPicker();
  const updateRole = useUpdateMemberRole();
  const kickMember = useKickMember();

  const handleAssignPicker = (userId: number) => {
    assignPicker.mutate(
      { groupId, data: { userId } },
      {
        onSuccess: () => {
          toast({ title: "Picker assigned!" });
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
          invalidate();
        },
        onError: (e: any) => {
          toast({ title: "Error", description: e.data?.error, variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="group-detail-page cinema-loading-page">
        <VHSNoise />
        <CinemaLoadingDeck />
      </div>
    );
  }

  if (isGroupError || !group) {
    return (
      <div className="group-detail-page cinema-signal-lost">
        <VHSNoise />
        {entryPhase !== "hidden" && (
          <CinemaRouteCurtain phase={entryPhase} clubName={group?.name} />
        )}
        {isExiting && <CinemaRouteCurtain phase="exiting" clubName={group?.name} />}
        <div className="cinema-signal-lost__panel" role="alert">
          <span className="cinema-signal-lost__code">NO SIGNAL · E-404</span>
          <h1>Movie night unavailable</h1>
          <p>The tape could not be loaded. Check your connection or return to your clubs.</p>
          <button
            onClick={exitToDashboard}
            className="vcr-button vcr-button--primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isAdminOrOwner = group.myRole === "owner" || group.myRole === "admin";
  const currentTurnWeekOf = group.currentTurnWeekOf as string;
  const effectiveSelectedWeek = (group.weekOf as string | undefined) || selectedWeek || currentTurnWeekOf;
  const movie = group.movieData;
  const pickerSchedule = group.pickerSchedule;
  // When reviews are open (not locked by an admin), the aggregate ratings stay
  // hidden and we show a lock instead, so members rate without seeing others'.
  const reviewsUnlocked = (group as unknown as { reviewsUnlocked?: boolean }).reviewsUnlocked ?? false;

  // The assigned picker of a turn sets that turn's movie. The movie view is clamped
  // to the current turn for members, so in practice this gates the current turn's
  // picker — matching the backend authorization (assigned picker, current-or-later).
  const isPickerForSelectedTurn = group.pickerUserId === me?.id;
  const canEditMovie = isAdminOrOwner
    || !!group.movieUnlockedByAdmin
    || (normalizeWeekOf(effectiveSelectedWeek) === normalizeWeekOf(currentTurnWeekOf) && isPickerForSelectedTurn);

  return (
    <div className="group-detail-page min-h-screen bg-background flex relative">
      <VHSNoise />
      {entryPhase !== "hidden" && (
        <CinemaRouteCurtain phase={entryPhase} clubName={group.name} />
      )}
      {isExiting && <CinemaRouteCurtain phase="exiting" clubName={group.name} />}
      <div className="flex-1 flex flex-col">
        <header className="group-detail-header border-b-4 border-primary sticky top-0 z-20 bg-secondary">
          <div className="group-detail-header-inner px-4 sm:px-6 lg:px-8 py-2 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 mr-2">
              <button
                onClick={exitToDashboard}
                disabled={isExiting}
                className="vcr-header-control text-white hover:text-primary transition-colors flex-shrink-0"
                aria-label="Back to clubs"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="font-black text-primary uppercase truncate text-sm sm:text-2xl">{group.name}</h1>
                <p className="text-xs sm:text-sm text-white/80 capitalize">{group.myRole}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Open movie club controls"
                    className={`p-2 sm:p-2.5 border-2 transition-all ${
                      pickerScheduleOpen || nominationsOpen
                        ? "bg-primary text-secondary border-primary"
                        : "bg-secondary text-white border-white/30 hover:border-primary"
                    }`}
                  >
                    <LayoutList className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-secondary border-2 border-primary">
                  <DropdownMenuItem
                    onClick={() => setPickerScheduleOpen(true)}
                    className="font-bold uppercase text-sm cursor-pointer text-white hover:bg-primary hover:text-secondary focus:bg-primary focus:text-secondary"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Picker Schedule
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setNominationsOpen(true)}
                    className="font-bold uppercase text-sm cursor-pointer text-white hover:bg-primary hover:text-secondary focus:bg-primary focus:text-secondary"
                  >
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Nominations Pool
                  </DropdownMenuItem>
                  {isAdminOrOwner && (
                    <DropdownMenuItem
                      onClick={() => setLocation(`/groups/${groupId}/admin`)}
                      className="sm:hidden font-bold uppercase text-sm cursor-pointer text-white hover:bg-primary hover:text-secondary focus:bg-primary focus:text-secondary"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Club Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setLocation("/settings")}
                    className="sm:hidden font-bold uppercase text-sm cursor-pointer text-white hover:bg-primary hover:text-secondary focus:bg-primary focus:text-secondary"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {isAdminOrOwner && (
                <button
                  onClick={() => setLocation(`/groups/${groupId}/admin`)}
                  className="hidden sm:flex p-2 sm:p-2.5 border-2 border-white/30 hover:border-primary bg-secondary text-white hover:text-primary transition-all"
                  title="Club admin"
                >
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
              <button
                onClick={() => setLocation("/settings")}
                className="hidden sm:flex p-2 sm:p-2.5 border-2 border-white/30 hover:border-primary bg-secondary text-white hover:text-primary transition-all"
                title="Settings"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              {me && (
                <UserLink userId={me.id} ariaLabel="Open your profile">
                  <Avatar className="w-8 h-8 sm:w-9 sm:h-9 border-2 border-white/30 hover:border-primary transition-all">
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

        <main className="group-detail-main flex-1 px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="max-w-5xl mx-auto relative">

        <WeeklyShowingsCarousel
          groupId={groupId}
          group={group}
          status={status}
          selectedWeek={effectiveSelectedWeek}
          onWeekChange={handleWeekChange}
          isNavigating={isPlaceholderData || navigationLockRef.current}
        />

        {isStatusError && (
          <div className="cinema-inline-error" role="status">
            Tracking lost: live rating status is temporarily unavailable.
          </div>
        )}

        {/* The carousel owns the cinematic transition. The page content swaps as a
            stable frame once the matching response is ready, preventing two
            competing animations from slicing the mobile layout. */}
          <div
            key={effectiveSelectedWeek}
            className="turn-transition-frame"
            data-direction={navDirection < 0 ? "rewind" : "forward"}
          >
            {showMovieInput ? (
              <div className="border-4 border-secondary bg-card p-6 mb-8">
                <PickerMovieSelector
                  groupId={groupId}
                  selectedWeek={effectiveSelectedWeek}
                  onCancel={() => setShowMovieInput(false)}
                  onSuccess={() => setShowMovieInput(false)}
                />
              </div>
            ) : (
              <CurrentTurnMovie
                group={group}
                status={status}
                selectedWeek={effectiveSelectedWeek}
                canEditMovie={canEditMovie}
                onEditMovie={() => setShowMovieInput(true)}
              />
            )}

            {status?.votingOpen && movie && (
              <VerdictForm
                group={group}
                status={status}
                groupId={groupId}
                selectedWeek={effectiveSelectedWeek}
              />
            )}

            {reviewsUnlocked && movie && (
              <div className="border-4 border-secondary bg-card p-6 mb-6 flex items-center gap-4">
                <span className="text-3xl" aria-hidden>🔒</span>
                <div>
                  <p className="font-black text-primary uppercase">Ratings Locked</p>
                  <p className="text-sm text-white/70">
                    Hidden while reviews are open — they'll show once an admin locks reviews.
                  </p>
                </div>
              </div>
            )}

            {group.resultsAvailable && (
              <TurnResultsInline
                groupId={groupId}
                selectedWeek={effectiveSelectedWeek}
                members={group.members}
              />
            )}
          </div>

        {/* Watch Status / Members - only shown when results not available */}
        {!group.resultsAvailable && (
          <WatchStatusShelf
            members={group.members}
            pickerUserId={status?.pickerUserId}
            isAdminOrOwner={isAdminOrOwner}
            onAssignPicker={handleAssignPicker}
            onUpdateRole={handleUpdateRole}
            onKick={handleKick}
          />
        )}
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
                          {slot.pickerUserId ? (
                            <UserLink userId={slot.pickerUserId}>
                              <Avatar className="w-8 h-8 border-2 border-primary">
                                <AvatarImage
                                  src={group.members.find(m => m.id === slot.pickerUserId)?.avatarUrl ?? undefined}
                                  alt={slot.pickerUsername ?? "Picker"}
                                />
                                <AvatarFallback className="bg-primary text-secondary text-xs font-bold">
                                  {(slot.pickerUsername ?? "??").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </UserLink>
                          ) : (
                            <div className="w-8 h-8 bg-primary flex items-center justify-center">
                              <User className="w-4 h-4 text-secondary" />
                            </div>
                          )}
                          {slot.pickerUserId ? (
                            <UserLink userId={slot.pickerUserId}>
                              <span className="text-sm font-bold text-white hover:text-primary transition-colors">
                                {slot.pickerUsername ?? "Unassigned"}
                              </span>
                            </UserLink>
                          ) : (
                            <span className="text-sm font-bold text-white">Unassigned</span>
                          )}
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
