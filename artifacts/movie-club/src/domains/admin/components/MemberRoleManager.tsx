import { useState } from "react";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiCall, ConfirmDialog } from "./shared";
import { OwnershipTransferTrigger } from "./OwnershipTransferDialog";

interface GroupMember {
  id: number;
  username: string;
  role: string;
}

interface MemberRoleManagerProps {
  groupId: number;
  members: GroupMember[];
  isOwner: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onMutate: () => void;
}

export function MemberRoleManager({
  groupId,
  members,
  isOwner,
  isExpanded,
  onToggle,
  onMutate,
}: MemberRoleManagerProps) {
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<{ message: string; action: () => void; variant?: "destructive" | "warning" } | null>(null);

  const withConfirm = (message: string, action: () => void, variant: "destructive" | "warning" = "destructive") => {
    setConfirm({ message, action, variant });
  };

  const doAction = async (action: () => Promise<void>) => {
    try {
      await action();
      onMutate();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
    }
  };

  const handleUpdateRole = async (userId: number, username: string, newRole: string) => {
    withConfirm(
      `Change ${username}'s role to "${newRole}"?`,
      async () => {
        await doAction(async () => {
          await apiCall(`/api/groups/${groupId}/role`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, role: newRole }),
          });
          toast({ title: `Role updated to ${newRole}` });
        });
      },
      "warning"
    );
  };


  return (
    <>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          variant={confirm.variant}
          onConfirm={() => { confirm.action(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="bg-card/50 border border-border/30 rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
          onClick={onToggle}
        >
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-serif font-semibold text-foreground">Role Management</span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {isExpanded && (
          <div className="border-t border-border/20 p-4">
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-foreground">{member.username}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${
                        member.role === "owner"
                          ? "border-primary/40 text-primary"
                          : member.role === "admin"
                          ? "border-secondary/40 text-secondary"
                          : "border-border/40 text-muted-foreground"
                      }`}
                    >
                      {member.role}
                    </Badge>
                    {member.role !== "owner" && isOwner && (
                      <div className="flex items-center gap-1">
                        {member.role !== "admin" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleUpdateRole(member.id, member.username, "admin")}
                          >
                            → Admin
                          </Button>
                        )}
                        {member.role === "admin" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleUpdateRole(member.id, member.username, "member")}
                          >
                            → Member
                          </Button>
                        )}
                        <OwnershipTransferTrigger
                          groupId={groupId}
                          memberId={member.id}
                          memberUsername={member.username}
                          onTransferred={onMutate}
                        />
                      </div>
                    )}
                    {member.role === "admin" && !isOwner && (
                      <span className="text-xs text-muted-foreground/60">(only owner can change)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!isOwner && (
              <p className="text-xs text-muted-foreground/60 italic mt-3">
                Only the group owner can promote, demote, or transfer ownership.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
