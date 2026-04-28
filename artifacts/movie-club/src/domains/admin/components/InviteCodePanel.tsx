import { useState } from "react";
import {
  Link,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useGetActiveInvite,
  useCreateInvite,
  getGetActiveInviteQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface InviteCodePanelProps {
  groupId: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function InviteCodePanel({
  groupId,
  isExpanded,
  onToggle,
}: InviteCodePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedCode, setCopiedCode] = useState(false);

  const { data: activeInvite, isLoading } = useGetActiveInvite(groupId, {
    query: {
      queryKey: getGetActiveInviteQueryKey(groupId),
      enabled: !!groupId,
    },
  });

  const createInvite = useCreateInvite();

  const handleGenerateInvite = () => {
    createInvite.mutate(
      { groupId, data: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetActiveInviteQueryKey(groupId) });
          toast({ title: "Invite code generated" });
        },
        onError: (e: any) => {
          toast({
            title: "Error",
            description: e.data?.error || "Failed to generate invite",
            variant: "destructive",
          });
        },
      }
    );
  };

  const copyCode = () => {
    if (!activeInvite?.code) return;
    navigator.clipboard.writeText(activeInvite.code);
    setCopiedCode(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const inviteCode = activeInvite?.code;

  return (
    <div className="bg-card/50 border border-border/30 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2.5">
          <Link className="w-4 h-4 text-primary" />
          <span className="font-serif font-semibold text-foreground">Invite Code</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border/20 p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Share this invite code with people you want to join your movie club.
            Only one invite code is active at a time.
          </p>

          {isLoading ? (
            <div className="h-12 bg-muted/20 rounded-lg animate-pulse" />
          ) : inviteCode ? (
            <div className="flex items-center gap-3 bg-background border border-border rounded-lg p-3">
              <code className="text-primary font-mono text-lg flex-1 tracking-widest font-bold select-all">
                {inviteCode}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={copyCode}
                className="flex-shrink-0"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground/60 bg-muted/10 border border-border/20 rounded-lg p-3 text-center">
              No active invite code
            </div>
          )}

          <Button
            size="sm"
            onClick={handleGenerateInvite}
            disabled={createInvite.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${createInvite.isPending ? "animate-spin" : ""}`} />
            {inviteCode ? "Regenerate Code" : "Generate Code"}
          </Button>
        </div>
      )}
    </div>
  );
}
