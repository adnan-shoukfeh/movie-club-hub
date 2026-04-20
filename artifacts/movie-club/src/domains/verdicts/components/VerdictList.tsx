import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="flex justify-start">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setLocation(`/groups/${groupId}/results?weekOf=${selectedWeek}`)}
        className="border-secondary/30 text-secondary hover:bg-secondary/10"
      >
        <Trophy className="w-3.5 h-3.5 mr-1.5" />
        View Results
      </Button>
    </div>
  );
}
