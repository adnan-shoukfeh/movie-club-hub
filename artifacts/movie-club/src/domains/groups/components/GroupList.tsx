import { Film, Users, Play, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { GroupSummary } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface GroupCardProps {
  group: GroupSummary;
  onClick: () => void;
  isLarge?: boolean;
}

function GroupCard({ group, onClick, isLarge }: GroupCardProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden border-4 border-secondary bg-card hover:border-primary transition-all text-left ${
        isLarge ? "lg:col-span-8 lg:row-span-2" : "lg:col-span-4"
      }`}
    >
      <div className="relative p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-xl font-black text-primary mb-1 uppercase">{group.name}</h3>
            <p className="text-sm text-white/70 capitalize">{group.role}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary border-2 border-primary">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-white">{group.memberCount}</span>
          </div>
        </div>

        {group.currentMovie && (
          <div className="mt-auto flex items-center gap-4 pt-4 border-t-2 border-secondary">
            <div className="w-16 h-24 bg-secondary border-4 border-primary flex items-center justify-center shrink-0 overflow-hidden">
              {group.moviePoster ? (
                <img src={group.moviePoster} alt={group.currentMovie} className="w-full h-full object-cover" />
              ) : (
                <Film className="w-8 h-8 text-primary/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Play className="w-4 h-4 text-primary fill-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-widest">
                  {group.resultsAvailable ? "Results Ready" : group.votingOpen ? "Now Playing" : "Up Next"}
                </span>
              </div>
              <p className="font-bold text-white truncate mb-1">
                {group.currentMovie}
              </p>
              {group.votingOpen && !group.hasVoted && (
                <span className="inline-block px-2 py-0.5 bg-primary text-secondary text-xs font-bold uppercase">
                  Rate Now
                </span>
              )}
              {group.hasVoted && group.votingOpen && (
                <span className="inline-block px-2 py-0.5 bg-secondary border border-primary/50 text-primary text-xs font-bold uppercase">
                  Rated
                </span>
              )}
            </div>
          </div>
        )}

        {!group.currentMovie && (
          <div className="mt-auto pt-4 border-t-2 border-secondary">
            <p className="text-sm text-white/50 font-bold uppercase">No movie set this week</p>
          </div>
        )}
      </div>
    </button>
  );
}

interface GroupListProps {
  groups: GroupSummary[] | undefined;
  isLoading: boolean;
}

export function GroupList({ groups, isLoading }: GroupListProps) {
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className={`h-40 ${i === 1 ? "lg:col-span-8" : "lg:col-span-4"}`} />
        ))}
      </div>
    );
  }

  if (groups && groups.length > 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-12">
        {groups.map((group, index) => (
          <GroupCard
            key={group.id}
            group={group}
            isLarge={index === 0}
            onClick={() => setLocation(`/groups/${group.id}`)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="border-4 border-secondary bg-card p-12 text-center mb-12">
      <Film className="w-12 h-12 text-secondary mx-auto mb-4" />
      <p className="text-white font-bold uppercase mb-2">No clubs yet</p>
      <p className="text-white/60 text-sm mb-6">Create a club or join one with an invite code.</p>
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => setLocation("/groups/new")}
          className="px-6 py-3 bg-primary text-secondary border-4 border-secondary hover:bg-secondary hover:text-primary hover:border-primary transition-all font-black uppercase flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create a Club
        </button>
        <button
          onClick={() => setLocation("/join")}
          className="px-6 py-3 bg-secondary text-white border-4 border-primary hover:bg-primary hover:text-secondary transition-all font-black uppercase"
        >
          Join with Code
        </button>
      </div>
    </div>
  );
}
