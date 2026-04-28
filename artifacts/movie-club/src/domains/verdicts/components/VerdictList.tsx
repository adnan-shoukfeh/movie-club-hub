import { Trophy, Award } from "lucide-react";
import { useLocation } from "wouter";
import type { GroupDetail, GroupStatus } from "@workspace/api-client-react";

interface VerdictListProps {
  groupId: number;
  group: GroupDetail;
  status: GroupStatus | undefined;
  selectedWeek: string;
}

export function VerdictList({ groupId, group, status, selectedWeek }: VerdictListProps) {
  const [, setLocation] = useLocation();

  if (!group.resultsAvailable || !group.movieData) {
    return null;
  }

  return (
    <div className="border-4 border-primary bg-secondary p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-primary flex items-center justify-center">
          <Award className="w-7 h-7 text-secondary" />
        </div>
        <h3 className="text-2xl font-black text-primary uppercase">Results Available</h3>
      </div>
      <p className="text-white/70 mb-4">The turn has ended and all ratings are now visible.</p>
      <button
        onClick={() => setLocation(`/groups/${groupId}/results?weekOf=${selectedWeek}`)}
        className="px-6 py-3 bg-primary text-secondary border-4 border-secondary hover:bg-card hover:text-primary hover:border-primary transition-all font-black uppercase flex items-center gap-2"
      >
        <Trophy className="w-5 h-5" />
        View Full Results
      </button>
    </div>
  );
}
