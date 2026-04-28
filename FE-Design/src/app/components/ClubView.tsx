import { useState } from "react";
import { useParams, Link } from "react-router";
import { clubs, movies, users, currentUserId } from "../data/mockData";
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar, Lightbulb, Settings, Film, Star, Clock, Check, X, Plus, User } from "lucide-react";
import { RatingReview } from "./RatingReview";
import { TurnResults } from "./TurnResults";
import { VHSNoise } from "./VHSNoise";

type SidebarView = null | "schedule" | "suggestions";

export function ClubView() {
  const { clubId } = useParams();
  const club = clubs[clubId!];
  const [currentTurnIndex, setCurrentTurnIndex] = useState(
    club.turns.findIndex((t) => t.isEnded) !== -1
      ? club.turns.findIndex((t) => t.isEnded)
      : club.turns.findIndex((t) => t.isActive)
  );
  const [sidebarView, setSidebarView] = useState<SidebarView>(null);

  if (!club) return <div>Club not found</div>;

  const turn = club.turns[currentTurnIndex];
  const movie = movies[turn.movieId];
  const picker = users[turn.pickerId];
  const isAdmin = club.adminIds.includes(currentUserId);
  const isPicker = turn.pickerId === currentUserId;
  const hasWatched = turn.watchedBy.includes(currentUserId);
  const hasRated = turn.ratings.some((r) => r.userId === currentUserId);
  const canNavigatePrev = currentTurnIndex > 0;
  const canNavigateNext = currentTurnIndex < club.turns.length - 1;

  const suggestions = club.suggestions.map((s) => ({
    ...movies[s.movieId],
    nominatedBy: users[s.nominatedBy].name,
    nominatorAvatar: users[s.nominatedBy].avatar,
  }));

  return (
    <div className="min-h-screen bg-[#000814] flex relative">
      <VHSNoise />
      <div className="flex-1 flex flex-col">
        <header className="border-b-4 border-[#FDB913] sticky top-0 z-20 bg-[#003087]">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-white hover:text-[#FDB913] transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-black text-[#FDB913] uppercase">{club.name}</h1>
                <p className="text-sm text-white/80">Turn {turn.turnNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarView(sidebarView === "schedule" ? null : "schedule")}
                className={`p-2.5 border-2 transition-all ${
                  sidebarView === "schedule"
                    ? "bg-[#FDB913] text-[#003087] border-[#FDB913]"
                    : "bg-[#003087] text-white border-white/30 hover:border-[#FDB913]"
                }`}
              >
                <Calendar className="w-5 h-5" />
              </button>
              <button
                onClick={() => setSidebarView(sidebarView === "suggestions" ? null : "suggestions")}
                className={`p-2.5 border-2 transition-all ${
                  sidebarView === "suggestions"
                    ? "bg-[#FDB913] text-[#003087] border-[#FDB913]"
                    : "bg-[#003087] text-white border-white/30 hover:border-[#FDB913]"
                }`}
              >
                <Lightbulb className="w-5 h-5" />
              </button>
              {isAdmin && (
                <Link
                  to={`/club/${clubId}/admin`}
                  className="p-2.5 border-2 border-white/30 hover:border-[#FDB913] bg-[#003087] text-white hover:text-[#FDB913] transition-all"
                >
                  <Settings className="w-5 h-5" />
                </Link>
              )}
              {(isAdmin || isPicker) && (
                <Link
                  to={`/club/${clubId}/select-movie`}
                  className="px-4 py-2 bg-[#FDB913] text-[#003087] border-2 border-[#003087] hover:bg-[#003087] hover:text-[#FDB913] hover:border-[#FDB913] transition-all font-black uppercase text-sm"
                >
                  Select Movie
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={() => setCurrentTurnIndex(currentTurnIndex - 1)}
                disabled={!canNavigatePrev}
                className="p-3 bg-[#001d3d] border-4 border-[#003087] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#FDB913] transition-all"
              >
                <ChevronLeft className="w-6 h-6 text-[#FDB913]" />
              </button>
              <div className="text-center bg-[#FDB913] px-6 py-3 border-4 border-[#003087]">
                <p className="text-sm text-[#003087] font-bold mb-1">
                  {turn.startDate} - {turn.endDate}
                </p>
                {turn.isActive && (
                  <span className="inline-block px-4 py-1 bg-[#003087] text-[#FDB913] text-xs font-black uppercase tracking-wider">
                    Active Turn
                  </span>
                )}
                {turn.isEnded && (
                  <span className="inline-block px-4 py-1 bg-[#003087] text-white text-xs font-black uppercase tracking-wider">
                    Final Results
                  </span>
                )}
              </div>
              <button
                onClick={() => setCurrentTurnIndex(currentTurnIndex + 1)}
                disabled={!canNavigateNext}
                className="p-3 bg-[#001d3d] border-4 border-[#003087] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#FDB913] transition-all"
              >
                <ChevronRight className="w-6 h-6 text-[#FDB913]" />
              </button>
            </div>

            <div className="border-8 border-[#FDB913] bg-[#001d3d] mb-8 overflow-hidden">
              <div className="md:flex">
                <div className="md:w-2/5 p-8 flex items-center justify-center bg-black">
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="max-w-full h-auto border-8 border-[#003087]"
                  />
                </div>
                <div className="p-8 md:w-3/5 flex flex-col justify-center bg-[#001d3d]">
                  <h2 className="text-4xl font-black text-[#FDB913] mb-4 uppercase tracking-tight">
                    {movie.title}
                  </h2>
                  <div className="flex flex-wrap gap-3 text-sm text-white mb-6">
                    <span className="px-4 py-2 bg-[#003087] border-2 border-[#FDB913] font-bold">
                      {movie.year}
                    </span>
                    <span className="px-4 py-2 bg-[#003087] border-2 border-white/30 font-bold">
                      {movie.runtime} min
                    </span>
                    <span className="px-4 py-2 bg-[#003087] border-2 border-white/30 font-bold">
                      {movie.director}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {movie.genre.map((g) => (
                      <span
                        key={g}
                        className="px-3 py-1.5 bg-[#003087] text-white border-2 border-white/30 text-sm font-bold uppercase"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                  <div className="pt-4 border-t-4 border-[#003087] flex items-center gap-3">
                    <img
                      src={picker.avatar}
                      alt={picker.name}
                      className="w-12 h-12 rounded-full border-4 border-[#FDB913]"
                    />
                    <div>
                      <p className="text-xs text-white/70 uppercase tracking-wider font-bold">Picked by</p>
                      <p className="font-black text-white text-lg">{picker.name}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 mb-6">
              <h3 className="font-black text-[#FDB913] mb-4 text-xl flex items-center gap-2 uppercase">
                <User className="w-6 h-6" />
                Watch Status
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {club.memberIds.map((memberId) => {
                  const member = users[memberId];
                  const watched = turn.watchedBy.includes(memberId);
                  const rated = turn.ratings.some((r) => r.userId === memberId);

                  return (
                    <div key={memberId} className="p-3 bg-[#003087] border-2 border-white/20">
                      <div className="flex items-center gap-2 mb-2">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-10 h-10 rounded-full border-2 border-[#FDB913]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{member.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {watched ? (
                          <div className="flex items-center gap-1 text-[#FDB913] font-bold">
                            <Check className="w-3 h-3" />
                            Watched
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-white/50 font-bold">
                            <Clock className="w-3 h-3" />
                            Pending
                          </div>
                        )}
                        {rated && !turn.isEnded && (
                          <span className="ml-1 text-[#FDB913]">★</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {turn.isActive && !hasRated && hasWatched && (
              <RatingReview turnId={turn.id} clubId={club.id} />
            )}

            {turn.isEnded && <TurnResults turn={turn} clubMembers={club.memberIds} />}

            {turn.isEnded && !club.settings.reviewWindowLocked && isAdmin && (
              <div className="mt-6">
                <RatingReview turnId={turn.id} clubId={club.id} reopened />
              </div>
            )}
          </div>
        </main>
      </div>

      {sidebarView && (
        <>
          <div
            className="fixed inset-0 bg-black/80 z-30 lg:hidden"
            onClick={() => setSidebarView(null)}
          />
          <div className="fixed lg:relative right-0 top-0 bottom-0 w-80 lg:w-96 bg-[#001d3d] border-l-8 border-[#FDB913] z-40 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b-4 border-[#003087]">
                <h3 className="font-black text-[#FDB913] text-xl uppercase">
                  {sidebarView === "schedule" ? "Picker Schedule" : "Movie Suggestions"}
                </h3>
                <button
                  onClick={() => setSidebarView(null)}
                  className="p-1 hover:bg-[#003087] text-white lg:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {sidebarView === "schedule" && (
                <div className="space-y-3">
                  {club.turns.map((t) => {
                    const p = users[t.pickerId];
                    const m = movies[t.movieId];

                    return (
                      <div
                        key={t.id}
                        className={`p-4 border-4 transition-all ${
                          t.isActive
                            ? "border-[#FDB913] bg-[#003087]"
                            : "border-[#003087] bg-[#001d3d]"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-[#FDB913] flex items-center justify-center text-[#003087] font-black text-lg">
                            {t.turnNumber}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <img
                                src={p.avatar}
                                alt={p.name}
                                className="w-6 h-6 rounded-full border-2 border-[#FDB913]"
                              />
                              <p className="font-bold text-white text-sm">{p.name}</p>
                            </div>
                            <p className="text-xs text-white/60 mt-1 font-bold">
                              {t.startDate} - {t.endDate}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t-2 border-white/20">
                          <img
                            src={m.poster}
                            alt={m.title}
                            className="w-10 h-14 object-cover border-2 border-[#FDB913]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{m.title}</p>
                            <p className="text-xs text-white/60 font-bold">{m.year}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {sidebarView === "suggestions" && (
                <>
                  <button className="w-full mb-4 px-4 py-3 bg-[#FDB913] text-[#003087] border-4 border-[#003087] hover:bg-[#003087] hover:text-[#FDB913] hover:border-[#FDB913] transition-all font-black uppercase flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add Suggestion
                  </button>

                  {suggestions.length === 0 ? (
                    <div className="text-center py-12 border-4 border-[#003087] bg-[#001d3d]">
                      <Lightbulb className="w-12 h-12 text-[#003087] mx-auto mb-3" />
                      <p className="text-white text-sm font-bold">No suggestions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {suggestions.map((movie, index) => (
                        <div
                          key={index}
                          className="overflow-hidden border-4 border-[#003087] hover:border-[#FDB913] transition-all"
                        >
                          <img
                            src={movie.poster}
                            alt={movie.title}
                            className="w-full aspect-[16/9] object-cover"
                          />
                          <div className="p-4 bg-[#001d3d]">
                            <h4 className="font-black text-white mb-1 uppercase">{movie.title}</h4>
                            <p className="text-sm text-white/70 mb-3 font-bold">{movie.year}</p>
                            <div className="flex items-center gap-2">
                              <img
                                src={movie.nominatorAvatar}
                                alt={movie.nominatedBy}
                                className="w-6 h-6 rounded-full border-2 border-[#FDB913]"
                              />
                              <p className="text-xs text-white/70 font-bold">
                                Suggested by {movie.nominatedBy}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
