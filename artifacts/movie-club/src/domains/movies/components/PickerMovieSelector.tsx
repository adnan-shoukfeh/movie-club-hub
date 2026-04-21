import { useRef, useState, useEffect } from "react";
import { Search, X, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useSearchMovies,
  useSetMovie,
  getSearchMoviesQueryKey,
  getGetGroupQueryKey,
  getGetGroupStatusQueryKey,
  getGetDashboardQueryKey,
  getListNominationsQueryKey,
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

interface PickerMovieSelectorProps {
  groupId: number;
  selectedWeek: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export function PickerMovieSelector({
  groupId,
  selectedWeek,
  onCancel,
  onSuccess,
}: PickerMovieSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<{
    imdbId: string; title: string; year: string; poster: string | null;
  } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data: searchResults, isFetching: isSearching } = useSearchMovies(
    { q: debouncedQuery },
    { query: { queryKey: getSearchMoviesQueryKey({ q: debouncedQuery }), enabled: debouncedQuery.trim().length >= 2, staleTime: 30000 } }
  );

  const setMovie = useSetMovie();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetGroupStatusQueryKey(groupId) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListNominationsQueryKey(groupId) });
  };

  const handleSetMovie = () => {
    if (selectedMovie) {
      setMovie.mutate(
        { groupId, data: { title: selectedMovie.title, imdbId: selectedMovie.imdbId, weekOf: selectedWeek } },
        {
          onSuccess: () => {
            invalidate();
            onSuccess();
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
            invalidate();
            onSuccess();
          },
          onError: (e: any) => {
            toast({ title: "Error", description: e.data?.error ?? "Could not set movie", variant: "destructive" });
          },
        }
      );
    }
  };

  return (
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
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
