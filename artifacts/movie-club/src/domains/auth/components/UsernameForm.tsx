import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

async function apiCall<T = Record<string, unknown>>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, credentials: "include" });
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data as T;
}

interface UsernameFormProps {
  currentUsername: string;
}

export function UsernameForm({ currentUsername }: UsernameFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      toast({ title: "Username required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiCall("/api/me/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      toast({ title: "Username updated" });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setUsername("");
    } catch (err: unknown) {
      toast({
        title: "Failed to update username",
        description: err instanceof Error ? err.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card/50 border border-border/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <User className="w-4 h-4 text-primary" />
        <span className="font-serif font-semibold text-foreground">Username</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Current username: <span className="text-foreground font-medium">{currentUsername}</span>
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">New username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={currentUsername}
            maxLength={32}
            className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
          />
          <p className="text-xs text-muted-foreground/60 mt-1">2–32 characters, letters, numbers, and underscores only</p>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={saving || !username.trim()}
          className="bg-primary hover:bg-primary/90"
        >
          {saving ? "Saving..." : "Update Username"}
        </Button>
      </form>
    </div>
  );
}
