import { Film, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GroupSummary } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Plus } from "lucide-react";

interface GroupCardProps {
  group: GroupSummary;
  onClick: () => void;
}

function GroupCard({ group, onClick }: GroupCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border/50 rounded-xl p-5 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
            {group.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground capitalize">{group.role}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              {group.memberCount}
            </span>
          </div>
        </div>
        <div>
          {group.votingOpen && !group.hasVoted && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Rating open</Badge>
          )}
          {group.hasVoted && group.votingOpen && (
            <Badge variant="outline" className="text-xs text-muted-foreground">Rated</Badge>
          )}
          {group.resultsAvailable && (
            <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-xs">Results in</Badge>
          )}
        </div>
      </div>

      {group.currentMovie ? (
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-primary/70 shrink-0" />
          <span className="text-sm text-foreground/80 truncate">{group.currentMovie}</span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No movie set this week</p>
      )}
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
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (groups && groups.length > 0) {
    return (
      <div className="grid gap-3 mb-10">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            onClick={() => setLocation(`/groups/${group.id}`)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card/30 border border-border/20 rounded-xl p-12 text-center mb-10">
      <Film className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
      <p className="text-muted-foreground font-medium mb-2">No clubs yet</p>
      <p className="text-muted-foreground/60 text-sm mb-6">Create a club or join one with an invite code.</p>
      <div className="flex gap-3 justify-center">
        <Button onClick={() => setLocation("/groups/new")} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1.5" />
          Create a Club
        </Button>
        <Button variant="outline" onClick={() => setLocation("/join")}>
          Join with Code
        </Button>
      </div>
    </div>
  );
}
