import { useState } from "react";
import { Link, useParams } from "react-router";
import { clubs, movies, users } from "../data/mockData";
import { ArrowLeft, Search, Star, Film } from "lucide-react";
import { VHSNoise } from "./VHSNoise";

const searchResults = [
  {
    id: "search1",
    title: "Arrival",
    year: 2016,
    director: "Denis Villeneuve",
    genre: ["Sci-Fi", "Drama"],
    poster: "https://images.unsplash.com/photo-1574267432644-f74f8ec79a0f?w=400&h=600&fit=crop",
  },
  {
    id: "search2",
    title: "Mad Max: Fury Road",
    year: 2015,
    director: "George Miller",
    genre: ["Action", "Adventure"],
    poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=600&fit=crop",
  },
  {
    id: "search3",
    title: "The Shape of Water",
    year: 2017,
    director: "Guillermo del Toro",
    genre: ["Fantasy", "Drama"],
    poster: "https://images.unsplash.com/photo-1616530940355-351fabd9524b?w=400&h=600&fit=crop",
  },
];

export function MovieSelection() {
  const { clubId } = useParams();
  const club = clubs[clubId!];
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMovie, setSelectedMovie] = useState<string | null>(null);

  if (!club) return <div>Club not found</div>;

  const suggestions = club.suggestions.map((s) => ({
    ...movies[s.movieId],
    nominatedBy: users[s.nominatedBy].name,
  }));

  const handleSelectMovie = () => {
    alert("Movie selected! (In production, this would update your backend)");
  };

  return (
    <div className="min-h-screen bg-[#000814] relative">
      <VHSNoise />
      <header className="border-b-4 border-[#FDB913] sticky top-0 z-10 bg-[#003087]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link to={`/club/${clubId}`} className="text-white hover:text-[#FDB913] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FDB913] flex items-center justify-center">
              <Film className="w-7 h-7 text-[#003087]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#FDB913] uppercase">Select Movie</h1>
              <p className="text-sm text-white/80">{club.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="border-4 border-[#003087] bg-[#001d3d] p-6 mb-8">
          <h3 className="font-black text-[#FDB913] mb-4 text-2xl uppercase tracking-tight">Search Movies</h3>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-[#FDB913]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, director, or genre..."
              className="w-full pl-14 pr-4 py-4 border-4 border-[#003087] bg-[#001d3d] text-white placeholder:text-white/40 focus:outline-none focus:border-[#FDB913] font-medium text-lg"
            />
          </div>

          {searchQuery && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => setSelectedMovie(movie.id)}
                  className={`text-left p-4 transition-all border-4 ${
                    selectedMovie === movie.id ? "border-[#FDB913] bg-[#003087]" : "border-[#003087] bg-[#001d3d] hover:border-[#FDB913]"
                  }`}
                >
                  <div className="flex gap-3">
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-16 h-24 object-cover border-4 border-[#FDB913]"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-white truncate uppercase">{movie.title}</h4>
                      <p className="text-sm text-white/70 mb-1 font-bold">{movie.year}</p>
                      <p className="text-xs text-white/60 font-bold">{movie.director}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {movie.genre.map((g) => (
                          <span
                            key={g}
                            className="px-2 py-0.5 bg-[#FDB913] text-[#003087] text-xs font-black uppercase"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="border-4 border-[#003087] bg-[#001d3d] p-6">
            <h3 className="font-black text-[#FDB913] mb-6 text-2xl uppercase tracking-tight">Member Suggestions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestions.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => setSelectedMovie(movie.id)}
                  className={`text-left overflow-hidden transition-all border-4 ${
                    selectedMovie === movie.id ? "border-[#FDB913]" : "border-[#003087] hover:border-[#FDB913]"
                  }`}
                >
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full aspect-[2/3] object-cover"
                  />
                  <div className="p-4 bg-[#003087]">
                    <h4 className="font-black text-white mb-1 uppercase">{movie.title}</h4>
                    <p className="text-sm text-white/70 mb-2 font-bold">{movie.year}</p>
                    <p className="text-xs text-white/60 font-bold">
                      Suggested by {movie.nominatedBy}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedMovie && (
          <div className="fixed bottom-0 left-0 right-0 bg-[#003087] border-t-8 border-[#FDB913] p-6">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <p className="text-white font-black uppercase text-lg">Ready to select this movie?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedMovie(null)}
                  className="px-6 py-3 bg-[#001d3d] text-white border-4 border-white/30 hover:border-[#FDB913] font-black uppercase transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSelectMovie}
                  className="px-6 py-3 bg-[#FDB913] text-[#003087] border-4 border-[#003087] hover:bg-[#003087] hover:text-[#FDB913] hover:border-[#FDB913] font-black uppercase transition-all"
                >
                  Confirm Selection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
