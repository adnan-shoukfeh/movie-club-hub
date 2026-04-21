import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UsernameForm } from "@/domains/auth/components/UsernameForm";
import { PasswordForm } from "@/domains/auth/components/PasswordForm";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading } = useGetMe();

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
        <UsernameForm currentUsername={me.username} />
        <PasswordForm />
      </main>
    </div>
  );
}
