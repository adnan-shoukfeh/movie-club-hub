import { useRef, useState, useEffect } from "react";
import { BookOpen, Search, X, Film, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useSearchMovies,
  useListNominations,
  useSubmitNomination,
  useDeleteNomination,
  useGetMe,
  getSearchMoviesQueryKey,
  getListNominationsQueryKey,
  type Nomination as NominationItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface NominationSheetProps {
  groupId: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isAdminOrOwner: boolean;
  watchedMovieImdbId?: string | null;
  resultsAvailable: boolean;
}

export function NominationSheet({
  groupId,
  isOpen,
  onOpenChange,
  isAdminOrOwner,
  watchedMovieImdbId,
  resultsAvailable,
}: NominationSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();

  const [nomSearchQuery, setNomSearchQuery] = useState("");
  const [nomSelectedMovie, setNomSelectedMovie] = useState<{
    imdbId: string; title: string; year: string; poster: string | null;
  } | null>(null);
  const [nomShowDropdown, setNomShowDropdown] = useState(false);
  const [nomDuplicateMsg, setNomDuplicateMsg] = useState<string | null>(null);
  const nomSearchRef = useRef<HTMLDivElement>(null);

  const debouncedNomQuery = useDebounce(nomSearchQuery, 300);

  const { data: nomSearchResults, isFetching: isNomSearching } = useSearchMovies(
    { q: debouncedNomQuery },
    { query: { queryKey: getSearchMoviesQueryKey({ q: debouncedNomQuery }), enabled: debouncedNomQuery.trim().length >= 2, staleTime: 30000 } }
  );

  const { data: nominations, isLoading: nominationsLoading } = useListNominations(
    groupId,
    { query: { queryKey: getListNominationsQueryKey(groupId), enabled: !!groupId } }
  );

  const invalidateNominations = () => {
    queryClient.invalidateQueries({ queryKey: getListNominationsQueryKey(groupId) });
  };

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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (nomSearchRef.current && !nomSearchRef.current.contains(e.target as Node)) {
        setNomShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setNomSearchQuery("");
      setNomSelectedMovie(null);
      setNomShowDropdown(false);
      setNomDuplicateMsg(null);
    }
  };

  const watchedImdbIds = new Set<string>();
  if (resultsAvailable && watchedMovieImdbId) {
    watchedImdbIds.add(watchedMovieImdbId);
  }

  const renderNom = (nom: NominationItem, muted: boolean) => (
    <div
      key={nom.id}
      className={`flex items-center gap-3 p-2.5 border rounded-lg ${muted ? "bg-muted/10 border-border/10 opacity-50" : "bg-muted/20 border-border/10"}`}
    >
      {nom.poster ? (
        nom.imdbId ? (
          <a
            href={`https://www.imdb.com/title/${nom.imdbId}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <img src={nom.poster} alt={nom.title} className="w-8 h-11 object-cover rounded hover:opacity-80 transition-opacity" />
          </a>
        ) : (
          <img src={nom.poster} alt={nom.title} className="w-8 h-11 object-cover rounded flex-shrink-0" />
        )
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

  const activeNoms = nominations?.filter((n) => !watchedImdbIds.has(n.imdbId)) ?? [];
  const watchedNoms = nominations?.filter((n) => watchedImdbIds.has(n.imdbId)) ?? [];

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
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
            ) : nominations && nominations.length > 0 ? (
              <div className="space-y-2">
                {activeNoms.map((nom) => renderNom(nom, false))}
                {watchedNoms.length > 0 && (
                  <>
                    {activeNoms.length > 0 && <div className="border-t border-border/20 my-2" />}
                    {watchedNoms.map((nom) => renderNom(nom, true))}
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/60 italic text-center py-3">
                No nominations yet. Be the first to suggest a movie!
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
