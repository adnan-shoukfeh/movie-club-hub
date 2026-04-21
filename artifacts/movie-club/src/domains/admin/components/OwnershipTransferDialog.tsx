import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiCall, ConfirmDialog } from "./shared";

interface OwnershipTransferDialogProps {
  groupId: number;
  members: Array<{ id: number; username: string; role: string }>;
  onTransferred: () => void;
}

/**
 * Renders a "Transfer Ownership" button for each non-owner member.
 * Used within MemberRoleManager to isolate the transfer flow.
 */
export function OwnershipTransferTrigger({
  groupId,
  memberId,
  memberUsername,
  onTransferred,
}: {
  groupId: number;
  memberId: number;
  memberUsername: string;
  onTransferred: () => void;
}) {
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<{ message: string; action: () => void; variant?: "destructive" | "warning" } | null>(null);

  const handleTransfer = () => {
    setConfirm({
      message: `Transfer ownership to ${memberUsername}? You will become an admin, and you will lose the ability to transfer ownership back without their consent.`,
      action: async () => {
        try {
          await apiCall(`/api/admin/groups/${groupId}/transfer-ownership`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newOwnerId: memberId }),
          });
          toast({ title: "Ownership transferred", description: `${memberUsername} is now the owner` });
          onTransferred();
        } catch (e: unknown) {
          toast({ title: "Error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
        }
      },
      variant: "warning",
    });
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
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
        onClick={handleTransfer}
      >
        Transfer Ownership
      </Button>
    </>
  );
}

// Default export for cases where the full dialog orchestration is needed.
export function OwnershipTransferDialog({ groupId, members, onTransferred }: OwnershipTransferDialogProps) {
  return (
    <>
      {members
        .filter((m) => m.role !== "owner")
        .map((m) => (
          <OwnershipTransferTrigger
            key={m.id}
            groupId={groupId}
            memberId={m.id}
            memberUsername={m.username}
            onTransferred={onTransferred}
          />
        ))}
    </>
  );
}
