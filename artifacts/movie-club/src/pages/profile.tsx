import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, User, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

async function apiCall<T = Record<string, unknown>>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, credentials: "include" });
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data as T;
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me, isLoading } = useGetMe();

  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !me) setLocation("/");
  }, [isLoading, me, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!me) return null;

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      toast({ title: "Username required", variant: "destructive" });
      return;
    }
    setUsernameSaving(true);
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
      setUsernameSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "New password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setPasswordSaving(true);
    try {
      await apiCall("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast({ title: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast({
        title: "Failed to update password",
        description: err instanceof Error ? err.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <span className="font-serif font-semibold text-foreground">Profile Settings</span>
            <p className="text-xs text-muted-foreground">{me.username}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-4">

        {/* Username */}
        <div className="bg-card/50 border border-border/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-primary" />
            <span className="font-serif font-semibold text-foreground">Username</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Current username: <span className="text-foreground font-medium">{me.username}</span>
          </p>
          <form onSubmit={handleUpdateUsername} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">New username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={me.username}
                maxLength={32}
                className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">2–32 characters, letters, numbers, and underscores only</p>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={usernameSaving || !username.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {usernameSaving ? "Saving..." : "Update Username"}
            </Button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-card/50 border border-border/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-primary" />
            <span className="font-serif font-semibold text-foreground">Password</span>
          </div>
          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">Minimum 8 characters</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="bg-primary hover:bg-primary/90"
            >
              {passwordSaving ? "Saving..." : "Update Password"}
            </Button>
          </form>
        </div>

      </main>
    </div>
  );
}
