import { useGetInvite, useJoinGroup, getGetInviteQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Film, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function AcceptInvite() {
  const params = useParams<{ code: string }>();
  const code = params.code ?? "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: invite, isLoading } = useGetInvite(code, {
    query: { queryKey: getGetInviteQueryKey(code), enabled: !!code },
  });
  const joinGroup = useJoinGroup();

  const handleJoin = () => {
    joinGroup.mutate(
      { data: { code } },
      {
        onSuccess: (group) => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast({ title: `Joined "${group.name}"!` });
          setLocation(`/groups/${group.id}`);
        },
        onError: (e: any) => {
          toast({ title: "Could not join", description: e.data?.error ?? "Invalid or expired invite", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 text-muted-foreground"
          onClick={() => setLocation("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Dashboard
        </Button>

        {invite && invite.valid ? (
          <div>
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mb-5">
                <Film className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">You've been invited to join</p>
              <h1 className="font-serif text-2xl font-bold text-foreground">{invite.groupName}</h1>
              {invite.expiresAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Expires {new Date(invite.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>

            <Button
              className="w-full bg-primary hover:bg-primary/90"
              onClick={handleJoin}
              disabled={joinGroup.isPending}
            >
              <Users className="w-4 h-4 mr-2" />
              {joinGroup.isPending ? "Joining..." : "Join Club"}
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-foreground font-medium mb-2">Invalid or Expired Invite</p>
            <p className="text-muted-foreground/60 text-sm mb-6">
              This invite link is no longer valid. Ask the club owner for a new one.
            </p>
            <Button variant="outline" onClick={() => setLocation("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
