import { Link } from "react-router";
import { clubs, movies, recentMovies, users } from "../data/mockData";
import { Film, Users, Star, Play } from "lucide-react";
import { VHSNoise } from "./VHSNoise";

export function Dashboard() {
  const userClubs = Object.values(clubs);

  return (
    <div className="min-h-screen bg-[#000814] relative">
      <VHSNoise />
      <header className="border-b-4 border-[#FDB913] sticky top-0 z-10 bg-[#003087]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#FDB913] rounded flex items-center justify-center">
              <Film className="w-7 h-7 text-[#003087]" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-[#FDB913] tracking-tight">
                MOVIE CLUBS
              </h1>
              <p className="text-sm text-white/80">Your cinematic journey</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-12">
          {userClubs.map((club, index) => {
            const activeTurn = club.turns.find((t) => t.isActive);
            const movie = activeTurn ? movies[activeTurn.movieId] : null;
            const isLarge = index === 0;

            return (
              <Link
                key={club.id}
                to={`/club/${club.id}`}
                className={`group relative overflow-hidden border-4 border-[#003087] bg-[#001d3d] hover:border-[#FDB913] transition-all ${
                  isLarge ? "lg:col-span-8 lg:row-span-2" : "lg:col-span-4"
                }`}
              >
                <div className="relative p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-black text-[#FDB913] mb-1 uppercase">{club.name}</h3>
                      <p className="text-sm text-white/70">{club.description}</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#003087] border-2 border-[#FDB913]">
                      <Users className="w-4 h-4 text-[#FDB913]" />
                      <span className="text-sm font-bold text-white">{club.memberIds.length}</span>
                    </div>
                  </div>

                  {movie && (
                    <div className="mt-auto flex items-center gap-4 pt-4 border-t-2 border-[#003087]">
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        className="w-16 h-24 object-cover border-4 border-[#FDB913]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Play className="w-4 h-4 text-[#FDB913] fill-[#FDB913]" />
                          <span className="text-xs font-bold text-[#FDB913] uppercase tracking-widest">
                            Now Playing
                          </span>
                        </div>
                        <p className="font-bold text-white truncate mb-1">
                          {movie.title}
                        </p>
                        <p className="text-sm text-white/70">
                          Turn {activeTurn.turnNumber} · {users[activeTurn.pickerId].name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mb-6 bg-[#FDB913] px-6 py-3 border-4 border-[#003087] inline-flex items-center gap-3">
          <Star className="w-6 h-6 text-[#003087] fill-[#003087]" />
          <h2 className="text-xl font-black text-[#003087] uppercase tracking-wide">Recently Watched</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {recentMovies.map((recent, index) => {
            const movie = movies[recent.movieId];
            return (
              <div key={index} className="group cursor-pointer">
                <div className="relative aspect-[2/3] overflow-hidden mb-2 border-4 border-[#003087] group-hover:border-[#FDB913] transition-all bg-black">
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-[#FDB913] text-[#003087] px-2.5 py-1.5 flex items-center gap-1.5 border-2 border-[#003087]">
                    <Star className="w-3.5 h-3.5 fill-[#003087] text-[#003087]" />
                    <span className="font-black text-sm">{recent.rating}</span>
                  </div>
                </div>
                <h4 className="font-bold text-white truncate">{movie.title}</h4>
                <p className="text-sm text-white/70">{movie.year}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
