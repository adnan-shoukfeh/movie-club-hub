import {
  useGetGroup,
  useGetGroupStatus,
  useGetMe,
  useSubmitVote,
  useSetMovie,
  useAssignPicker,
  useUpdateMemberRole,
  useKickMember,
  useCreateInvite,
  useSetWatchStatus,
  useSearchMovies,
  useListNominations,
  useSubmitNomination,
  useDeleteNomination,
  getGetGroupQueryKey,
  getGetGroupStatusQueryKey,
  getGetDashboardQueryKey,
  getListNominationsQueryKey,
  getSearchMoviesQueryKey,
  type Nomination as NominationItem,
} from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Film,
  Users,
  Star,
  Trophy,
  Copy,
  Check,
  ChevronDown,
  Shield,
  User,
  Clapperboard,
  Plus,
  ChevronLeft,
  ChevronRight,
  Eye,
  Clock,
  Search,
  X,
  Pencil,
  CalendarCheck,
  Trash2,
  BookOpen,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDeadlineET, formatDateET, formatShortDateET } from "@/lib/utils";
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

interface TurnConfig {
  startDate: string;
  turnLengthDays: number;
  extensions: { turnIndex: number; extraDays: number }[];
}

function offsetWeekOf(weekOf: string, offset: number, config: TurnConfig): string {
  const start = new Date(config.startDate + "T00:00:00.000Z").getTime();
  const target = new Date(weekOf + "T00:00:00.000Z").getTime();
  if (target < start) {
    const idx = Math.max(0, offset);
    return getTurnStartDate(idx, config);
  }
  const idx = getTurnIndexForDate(weekOf, config);
  const newIdx = Math.max(0, idx + offset);
  return getTurnStartDate(newIdx, config);
}

function getTurnIndexForDate(dateStr: string, config: TurnConfig): number {
  const target = new Date(dateStr + "T00:00:00.000Z").getTime();
  const start = new Date(config.startDate + "T00:00:00.000Z").getTime();
  if (target < start) return 0;
  let idx = 0;
  let elapsed = 0;
  while (true) {
    const ext = config.extensions?.find((e) => e.turnIndex === idx);
    const turnDays = config.turnLengthDays + (ext?.extraDays ?? 0);
    const turnStartMs = start + elapsed * 86400000;
    const turnEndMs = turnStartMs + turnDays * 86400000;
    if (target < turnEndMs) return idx;
    elapsed += turnDays;
    idx++;
    if (idx > 10000) return idx;
  }
}

function getTurnStartDate(turnIndex: number, config: TurnConfig): string {
  const start = new Date(config.startDate + "T00:00:00.000Z");
  let total = 0;
  for (let i = 0; i < turnIndex; i++) {
    const ext = config.extensions?.find((e) => e.turnIndex === i);
    total += config.turnLengthDays + (ext?.extraDays ?? 0);
  }
  start.setUTCDate(start.getUTCDate() + total);
  return start.toISOString().slice(0, 10);
}

function formatWeekLabel(weekOf: string): string {
  return formatDateET(weekOf);
}

function formatShortDate(weekOf: string): string {
  return formatShortDateET(weekOf);
}

function CountdownTimer({ deadlineMs }: { deadlineMs: number }) {
  const now = Date.now();
  const diff = deadlineMs - now;
  if (diff <= 0) return <span className="text-muted-foreground text-sm">Rating closed</span>;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return (
    <span className="text-muted-foreground text-sm">
      {days > 0 ? `${days}d ` : ""}{hours}h {mins}m until reveal
    </span>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const ITEM_H = 48;

function WheelPicker({
  items,
  selectedIndex,
  onIndexChange,
  disabled = false,
}: {
  items: string[];
  selectedIndex: number;
  onIndexChange: (idx: number) => void;
  disabled?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const suppressRef = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    suppressRef.current = true;
    el.scrollTop = selectedIndex * ITEM_H;
    const t = setTimeout(() => { suppressRef.current = false; }, 80);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  const handleScroll = () => {
    if (suppressRef.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const el = listRef.current;
      if (!el) return;
      const idx = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      onIndexChange(idx);
    }, 80);
  };

  return (
    <div
      className={`relative select-none ${disabled ? "opacity-25 pointer-events-none" : ""}`}
      style={{ width: 56, height: ITEM_H * 3 }}
    >
      <div
        className="absolute inset-x-0 z-10 pointer-events-none border-y border-primary/50 bg-primary/10 rounded-sm"
        style={{ top: ITEM_H, height: ITEM_H }}
      />
      <div className="absolute inset-x-0 top-0 h-10 z-10 pointer-events-none bg-gradient-to-b from-card to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-10 z-10 pointer-events-none bg-gradient-to-t from-card to-transparent" />
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-scroll"
        style={{ scrollbarWidth: "none", scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <div style={{ height: ITEM_H }} />
        {items.map((item, i) => (
          <div
            key={i}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            className="flex items-center justify-center cursor-pointer"
            onClick={() => {
              onIndexChange(i);
              suppressRef.current = true;
              listRef.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
              setTimeout(() => { suppressRef.current = false; }, 400);
            }}
          >
            <span
              className={`font-bold tabular-nums transition-all duration-150 ${
                i === selectedIndex
                  ? "text-foreground text-2xl"
                  : Math.abs(i - selectedIndex) === 1
                  ? "text-muted-foreground/50 text-lg"
                  : "text-muted-foreground/20 text-base"
              }`}
            >
              {item}
            </span>
          </div>
        ))}
        <div style={{ height: ITEM_H }} />
      </div>
    </div>
  );
}

const INT_ITEMS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const DEC_ITEMS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function GroupDetail() {
  const params = useParams<{ groupId: string }>();
  const groupId = parseInt(params.groupId ?? "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedWeek, setSelectedWeek] = useState("");

  const [intIdx, setIntIdx] = useState(6);
  const [decIdx, setDecIdx] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [editingVote, setEditingVote] = useState(false);
  const [showVoteSuccess, setShowVoteSuccess] = useState(false);

  const [showMovieInput, setShowMovieInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<{
    imdbId: string; title: string; year: string; poster: string | null;
  } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [showInviteCode, setShowInviteCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showMemberActions, setShowMemberActions] = useState<number | null>(null);

  // Sheet open state
  const [pickerScheduleOpen, setPickerScheduleOpen] = useState(false);
  const [nominationsOpen, setNominationsOpen] = useState(false);

  // Nominations state
  const [nomSearchQuery, setNomSearchQuery] = useState("");
  const [nomSelectedMovie, setNomSelectedMovie] = useState<{
    imdbId: string; title: string; year: string; poster: string | null;
  } | null>(null);
  const [nomShowDropdown, setNomShowDropdown] = useState(false);
  const [nomDuplicateMsg, setNomDuplicateMsg] = useState<string | null>(null);
  const nomSearchRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);
  const debouncedNomQuery = useDebounce(nomSearchQuery, 300);

  const intValue = intIdx + 1;
  const effectiveRating = intValue === 10 ? 10 : intValue + decIdx / 10;

  useEffect(() => {
    if (intIdx === 9) setDecIdx(0);
  }, [intIdx]);

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

  const { data: searchResults, isFetching: isSearching } = useSearchMovies(
    { q: debouncedQuery },
    { query: { queryKey: getSearchMoviesQueryKey({ q: debouncedQuery }), enabled: debouncedQuery.trim().length >= 2, staleTime: 30000 } }
  );

  const { data: nomSearchResults, isFetching: isNomSearching } = useSearchMovies(
    { q: debouncedNomQuery },
    { query: { queryKey: getSearchMoviesQueryKey({ q: debouncedNomQuery }), enabled: debouncedNomQuery.trim().length >= 2, staleTime: 30000 } }
  );

  const { data: nominations, isLoading: nominationsLoading } = useListNominations(
    groupId,
    { query: { queryKey: getListNominationsQueryKey(groupId), enabled: !!groupId } }
  );

  useEffect(() => {
    if (group?.currentTurnWeekOf && selectedWeek === "") {
      setSelectedWeek(group.currentTurnWeekOf);
    }
  }, [group?.currentTurnWeekOf, selectedWeek]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (nomSearchRef.current && !nomSearchRef.current.contains(e.target as Node)) {
        setNomShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetGroupStatusQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  }, [queryClient, groupId]);

  const invalidateNominations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListNominationsQueryKey(groupId) });
  }, [queryClient, groupId]);

  const submitVote = useSubmitVote();
  const setMovie = useSetMovie();
  const assignPicker = useAssignPicker();
  const updateRole = useUpdateMemberRole();
  const kickMember = useKickMember();
  const createInvite = useCreateInvite();
  const setWatchStatus = useSetWatchStatus();

  const submitNomination = useSubmitNomination({
    mutation: {
      onSuccess: () => {
        setNomSearchQuery("");
        setNomSelectedMovie(null);
        setNomDuplicateMsg(null);
        invalidateNominations();
      },
      onError: (e) => {
        const data = (e as { data?: { nominatorUsername?: string; error?: string } } | null)?.data;
        if (data?.nominatorUsername) {
          setNomDuplicateMsg(`Already nominated by ${data.nominatorUsername}`);
        } else {
          toast({ title: "Error", description: data?.error ?? e.message, variant: "destructive" });
        }
      },
    },
  });

  const deleteNomination = useDeleteNomination({
    mutation: {
      onSuccess: () => {
        invalidateNominations();
      },
      onError: (e) => {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      },
    },
  });

  const clearVoteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/vote`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekOf: selectedWeek }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not clear vote");
      }
      return res.json();
    },
    onSuccess: () => {
      setEditingVote(false);
      setIntIdx(6);
      setDecIdx(0);
      setReviewText("");
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleStartEdit = () => {
    if (status?.myVote !== null && status?.myVote !== undefined) {
      const v = status.myVote;
      const int = Math.min(10, Math.max(1, Math.floor(v)));
      const dec = int === 10 ? 0 : Math.round((v - int) * 10);
      setIntIdx(int - 1);
      setDecIdx(dec);
    } else {
      setIntIdx(6);
      setDecIdx(0);
    }
    setReviewText(status?.myReview ?? "");
    setEditingVote(true);
  };

  const handleVote = () => {
    const rounded = Math.round(effectiveRating * 10) / 10;
    submitVote.mutate(
      { groupId, data: { rating: rounded, review: reviewText.trim() || undefined, weekOf: selectedWeek } },
      {
        onSuccess: () => {
          setEditingVote(false);
          setShowVoteSuccess(true);
          setTimeout(() => setShowVoteSuccess(false), 3000);
          if (!group?.myWatched) {
            setWatchStatus.mutate({ groupId, data: { watched: true, weekOf: selectedWeek } }, {
              onSuccess: () => invalidate(),
            });
          }
          invalidate();
        },
        onError: (e: any) => {
          toast({ title: "Error", description: e.data?.error ?? "Could not submit vote", variant: "destructive" });
        },
      }
    );
  };

  const handleNotYet = () => {
    setIntIdx(6);
    setDecIdx(0);
    setReviewText("");
    setEditingVote(false);
    handleWatchedToggle(false);
  };

  const handleSetMovie = () => {
    if (selectedMovie) {
      setMovie.mutate(
        { groupId, data: { title: selectedMovie.title, imdbId: selectedMovie.imdbId, weekOf: selectedWeek } },
        {
          onSuccess: () => {
            setShowMovieInput(false);
            setSelectedMovie(null);
            setSearchQuery("");
            invalidate();
            invalidateNominations();
          },
          onError: (e: any) => {
            toast({ title: "Error", description: e.data?.error ?? "Could not set movie", variant: "destructive" });
          },
        }
      );
    } else if (searchQuery.trim()) {
      setMovie.mutate(
        { groupId, data: { title: searchQuery.trim(), weekOf: selectedWeek } },
        {
          onSuccess: () => {
            setShowMovieInput(false);
            setSearchQuery("");
            invalidate();
          },
          onError: (e: any) => {
            toast({ title: "Error", description: e.data?.error ?? "Could not set movie", variant: "destructive" });
          },
        }
      );
    }
  };

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

  const handleWatchedToggle = (watched: boolean) => {
    setWatchStatus.mutate(
      { groupId, data: { watched, weekOf: selectedWeek } },
      {
        onSuccess: () => invalidate(),
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

  const handleNominateSubmit = () => {
    if (!nomSelectedMovie) return;
    setNomDuplicateMsg(null);
    submitNomination.mutate({
      groupId,
      data: {
        imdbId: nomSelectedMovie.imdbId,
        title: nomSelectedMovie.title,
        year: nomSelectedMovie.year ?? undefined,
        poster: nomSelectedMovie.poster ?? undefined,
      },
    });
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
  const canEditMovie = isAdminOrOwner || (!!group.movieUnlockedByAdmin && group.pickerUserId === me?.id);
  const currentTurnWeekOf = group.currentTurnWeekOf as string;
  const isCurrentWeek = selectedWeek === currentTurnWeekOf;
  const isPastWeek = selectedWeek < currentTurnWeekOf;
  const movie = group.movieData;
  const watchedCount = group.members.filter((m) => m.watched).length;
  const pickerSchedule = group.pickerSchedule;

  // Mirror the backend's isTurnWithinCap: allow up to currentTurnIdx + memberCount turns ahead.
  const _config = group.turnConfig as TurnConfig;
  const _currentIdx = getTurnIndexForDate(currentTurnWeekOf, _config);
  const _maxAllowedWeekOf = getTurnStartDate(_currentIdx + group.members.length, _config);
  const isAtFutureCap = selectedWeek >= _maxAllowedWeekOf;

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
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground/50 hover:text-muted-foreground"
                >
                  <MoreVertical className="w-4 h-4" />
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

        {/* Week navigation */}
        <div className="bg-card/30 border border-border/20 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedWeek(offsetWeekOf(selectedWeek, -1, group.turnConfig as TurnConfig))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {isCurrentWeek ? "This Turn" : isPastWeek ? "Past Turn" : "Future Turn"}
              </p>
              <p className="text-xs text-muted-foreground">{formatWeekLabel(selectedWeek)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedWeek(offsetWeekOf(selectedWeek, 1, group.turnConfig as TurnConfig))}
              disabled={(!isAdminOrOwner && isCurrentWeek) || isAtFutureCap}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          {!isCurrentWeek && (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-primary hover:text-primary/80 gap-1.5"
                onClick={() => setSelectedWeek(currentTurnWeekOf)}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                Back to current turn
              </Button>
            </div>
          )}
        </div>

        {/* Movie for this turn */}
        <div className="bg-card/50 border border-border/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
              <Film className="w-4 h-4 text-primary" />
              {isCurrentWeek ? "This Turn" : isPastWeek ? "Past Turn" : "Future Turn"}
            </h2>
            {canEditMovie && !showMovieInput && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowMovieInput(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {movie ? "Change" : "Set movie"}
              </Button>
            )}
          </div>

          {showMovieInput ? (
            <div className="space-y-3">
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={selectedMovie ? selectedMovie.title : searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedMovie(null);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search for a movie..."
                    className="w-full h-10 pl-9 pr-8 rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  {(searchQuery || selectedMovie) && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => { setSearchQuery(""); setSelectedMovie(null); setShowDropdown(false); }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {showDropdown && !selectedMovie && debouncedQuery.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-2xl z-30 max-h-72 overflow-y-auto">
                    {isSearching ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground text-center">Searching...</div>
                    ) : searchResults && searchResults.length > 0 ? (
                      searchResults.map((result) => (
                        <button
                          key={result.imdbId}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => { setSelectedMovie(result); setShowDropdown(false); }}
                        >
                          {result.poster ? (
                            <img src={result.poster} alt={result.title} className="w-9 h-12 object-cover rounded flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-12 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                              <Film className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                            <p className="text-xs text-muted-foreground">{result.year}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                        No results. Try a different title, or press Set to use your search term directly.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedMovie && (
                <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg p-3">
                  {selectedMovie.poster ? (
                    <img src={selectedMovie.poster} alt={selectedMovie.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-14 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                      <Film className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedMovie.title}</p>
                    <p className="text-xs text-muted-foreground">{selectedMovie.year}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSetMovie}
                  disabled={setMovie.isPending || (!selectedMovie && !searchQuery.trim())}
                  className="bg-primary hover:bg-primary/90"
                >
                  {setMovie.isPending ? "Setting..." : "Set Movie"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowMovieInput(false); setSelectedMovie(null); setSearchQuery(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : movie ? (
            <div className="flex gap-4">
              {movie.poster ? (
                <img
                  src={movie.poster}
                  alt={movie.title}
                  className="w-16 h-24 object-cover rounded-lg flex-shrink-0 shadow-lg"
                />
              ) : (
                <div className="w-16 h-24 bg-muted/40 rounded-lg flex-shrink-0 flex items-center justify-center">
                  <Film className="w-6 h-6 text-muted-foreground/50" />
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <h3 className="font-serif text-lg font-bold text-foreground leading-tight">{movie.title}</h3>
                {movie.year && <p className="text-xs text-muted-foreground mt-0.5">{movie.year}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                  {movie.genre && (
                    <span className="text-xs text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5">
                      {movie.genre}
                    </span>
                  )}
                  {movie.runtime && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {movie.runtime}
                    </span>
                  )}
                  {movie.director && (
                    <span className="text-xs text-muted-foreground">Dir. {movie.director}</span>
                  )}
                </div>
                <div className="mt-2 space-y-0.5">
                  {(movie.setByUsername ?? group.pickerUsername) && (
                    <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                      <Clapperboard className="w-3 h-3" />
                      Picked by <span className="font-medium text-muted-foreground">{movie.setByUsername ?? group.pickerUsername}</span>
                    </p>
                  )}
                  {movie.nominatorUsername && (
                    <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      Nominated by <span className="font-medium text-muted-foreground">{movie.nominatorUsername}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground/60 text-sm italic">
              {selectedWeek > currentTurnWeekOf
                ? isAdminOrOwner
                  ? "Set a movie for this upcoming turn."
                  : "No movie set yet for this turn."
                : "No movie was set for this turn."}
            </p>
          )}

          {status && isCurrentWeek && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/20">
              <div className="flex items-center gap-2">
                {status.votingOpen ? (
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Rating open</Badge>
                ) : status.resultsAvailable ? (
                  <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs">Revealed</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">No movie</Badge>
                )}
              </div>
              {status.deadlineMs && <CountdownTimer deadlineMs={status.deadlineMs} />}
            </div>
          )}
        </div>

        {/* Rating — only for current turn */}
        {status?.votingOpen && movie && (
          <div className="bg-card/50 border border-border/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold">
                {status.hasVoted && !editingVote ? "Your Rating" : "Rate this Film"}
              </h2>
              {status.hasVoted && !editingVote && (
                <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={handleStartEdit}>
                  <Pencil className="w-3 h-3 mr-1.5" />
                  Edit
                </Button>
              )}
            </div>

            {/* Watched status toggle */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border/20">
              <span className="text-xs text-muted-foreground mr-1">Watched?</span>
              <Button
                size="sm"
                variant={group.myWatched ? "default" : "outline"}
                className={`h-7 text-xs ${group.myWatched ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : ""}`}
                onClick={() => handleWatchedToggle(true)}
                disabled={setWatchStatus.isPending}
              >
                <Check className="w-3 h-3 mr-1" />
                Watched
              </Button>
              <Button
                size="sm"
                variant={!group.myWatched ? "default" : "outline"}
                className={`h-7 text-xs ${!group.myWatched ? "bg-muted hover:bg-muted/80 text-foreground" : ""}`}
                onClick={handleNotYet}
                disabled={setWatchStatus.isPending || !!status?.hasVoted}
                title={status?.hasVoted ? "Clear your rating first" : undefined}
              >
                Not Yet
              </Button>
              {status?.hasVoted && (
                <span className="text-xs text-muted-foreground/60 italic">Clear your rating to change this</span>
              )}
            </div>

            {/* 3-second success banner */}
            {showVoteSuccess && (
              <div className="mb-4 flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-3 py-2 text-sm">
                <Check className="w-4 h-4 shrink-0" />
                Rating saved! Results unlock Monday.
              </div>
            )}

            {status.hasVoted && !editingVote ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-background/60 border border-border/40 rounded-lg px-4 py-2">
                    <Star className="w-4 h-4 text-secondary fill-secondary/60" />
                    <span className="text-secondary font-bold text-lg tabular-nums">{status.myVote}</span>
                    <span className="text-muted-foreground text-sm">/ 10</span>
                  </div>
                </div>
                {status.myReview && (
                  <div className="bg-muted/20 rounded-lg px-4 py-3 text-sm text-foreground/80 italic border border-border/20">
                    "{status.myReview}"
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Wheel picker */}
                <div>
                  <p className="text-xs text-muted-foreground mb-3">Select your rating</p>
                  <div className="flex items-center justify-center gap-1">
                    <div className="bg-card border border-border/40 rounded-xl overflow-hidden">
                      <WheelPicker
                        items={INT_ITEMS}
                        selectedIndex={intIdx}
                        onIndexChange={setIntIdx}
                      />
                    </div>
                    <span className="text-2xl font-bold text-muted-foreground/60 pb-0.5 w-5 text-center">.</span>
                    <div className="bg-card border border-border/40 rounded-xl overflow-hidden">
                      <WheelPicker
                        items={DEC_ITEMS}
                        selectedIndex={decIdx}
                        onIndexChange={setDecIdx}
                        disabled={intIdx === 9}
                      />
                    </div>
                  </div>
                </div>

                {/* Review */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Review (optional)</p>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="What did you think? (hidden until reveal)"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90"
                    disabled={submitVote.isPending}
                    onClick={handleVote}
                  >
                    {submitVote.isPending
                      ? "Saving..."
                      : editingVote
                      ? `Update — ${effectiveRating.toFixed(1)}/10`
                      : `Submit — ${effectiveRating.toFixed(1)}/10`}
                  </Button>
                  {editingVote && (
                    <>
                      <Button variant="ghost" onClick={() => setEditingVote(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-destructive/70 hover:text-destructive"
                        disabled={clearVoteMutation.isPending}
                        onClick={() => clearVoteMutation.mutate()}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
                const isPast = slot.weekOf < currentTurnWeekOf;
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
                        {formatShortDate(slot.weekOf)} – {formatShortDate(slot.endDate)}
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

      {/* Nominations Pool Sheet */}
      <Sheet open={nominationsOpen} onOpenChange={(open) => {
        setNominationsOpen(open);
        if (!open) {
          setNomSearchQuery("");
          setNomSelectedMovie(null);
          setNomShowDropdown(false);
          setNomDuplicateMsg(null);
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col">
          <SheetHeader className="mb-5">
            <SheetTitle className="font-serif flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Nominations Pool
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 flex-1">
            {/* Submit nomination */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Suggest a movie for the group</p>
              <div className="relative" ref={nomSearchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={nomSelectedMovie ? nomSelectedMovie.title : nomSearchQuery}
                    onChange={(e) => {
                      setNomSearchQuery(e.target.value);
                      setNomSelectedMovie(null);
                      setNomShowDropdown(true);
                      setNomDuplicateMsg(null);
                    }}
                    onFocus={() => setNomShowDropdown(true)}
                    placeholder="Search to nominate a movie..."
                    className="w-full h-10 pl-9 pr-8 rounded-lg bg-background/60 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {(nomSearchQuery || nomSelectedMovie) && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => { setNomSearchQuery(""); setNomSelectedMovie(null); setNomShowDropdown(false); setNomDuplicateMsg(null); }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {nomShowDropdown && !nomSelectedMovie && debouncedNomQuery.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-2xl z-30 max-h-72 overflow-y-auto">
                    {isNomSearching ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground text-center">Searching...</div>
                    ) : nomSearchResults && nomSearchResults.length > 0 ? (
                      nomSearchResults.map((result) => (
                        <button
                          key={result.imdbId}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => { setNomSelectedMovie(result); setNomShowDropdown(false); }}
                        >
                          {result.poster ? (
                            <img src={result.poster} alt={result.title} className="w-9 h-12 object-cover rounded flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-12 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                              <Film className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                            <p className="text-xs text-muted-foreground">{result.year}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-muted-foreground text-center">No results found.</div>
                    )}
                  </div>
                )}
              </div>

              {nomSelectedMovie && (
                <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg p-3">
                  {nomSelectedMovie.poster ? (
                    <img src={nomSelectedMovie.poster} alt={nomSelectedMovie.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-14 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                      <Film className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{nomSelectedMovie.title}</p>
                    <p className="text-xs text-muted-foreground">{nomSelectedMovie.year}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleNominateSubmit}
                    disabled={submitNomination.isPending}
                    className="bg-primary hover:bg-primary/90 shrink-0"
                  >
                    {submitNomination.isPending ? "Nominating..." : "Nominate"}
                  </Button>
                </div>
              )}

              {nomDuplicateMsg && (
                <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg px-3 py-2 text-sm">
                  <Star className="w-4 h-4 shrink-0" />
                  {nomDuplicateMsg}
                </div>
              )}
            </div>

            {/* Nominations list */}
            <div>
              {nominationsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                </div>
              ) : nominations && nominations.length > 0 ? (() => {
                const watchedImdbIds = new Set<string>();
                if (group.resultsAvailable && group.movieData?.imdbId) {
                  watchedImdbIds.add(group.movieData.imdbId);
                }
                const activeNoms = nominations.filter((n) => !watchedImdbIds.has(n.imdbId));
                const watchedNoms = nominations.filter((n) => watchedImdbIds.has(n.imdbId));
                const renderNom = (nom: typeof nominations[number], muted: boolean) => (
                  <div
                    key={nom.id}
                    className={`flex items-center gap-3 p-2.5 border rounded-lg ${muted ? "bg-muted/10 border-border/10 opacity-50" : "bg-muted/20 border-border/10"}`}
                  >
                    {nom.poster ? (
                      <img src={nom.poster} alt={nom.title} className="w-8 h-11 object-cover rounded flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-11 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                        <Film className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${muted ? "text-muted-foreground" : "text-foreground"}`}>{nom.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {nom.year && <span>{nom.year} · </span>}
                        Nominated by <span className="font-medium">{nom.nominatorUsername ?? "Unknown"}</span>
                      </p>
                      {muted && (
                        <p className="text-xs text-muted-foreground/50 italic">Watched</p>
                      )}
                    </div>
                    {(isAdminOrOwner || nom.nominatorUserId === me?.id) && (
                      <button
                        className="text-muted-foreground/40 hover:text-destructive transition-colors"
                        onClick={() => deleteNomination.mutate({ groupId, nominationId: nom.id })}
                        disabled={deleteNomination.isPending}
                        title="Remove nomination"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
                return (
                  <div className="space-y-2">
                    {activeNoms.map((nom) => renderNom(nom, false))}
                    {watchedNoms.length > 0 && (
                      <>
                        {activeNoms.length > 0 && <div className="border-t border-border/20 my-2" />}
                        {watchedNoms.map((nom) => renderNom(nom, true))}
                      </>
                    )}
                  </div>
                );
              })() : (
                <p className="text-sm text-muted-foreground/60 italic text-center py-3">
                  No nominations yet. Be the first to suggest a movie!
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
