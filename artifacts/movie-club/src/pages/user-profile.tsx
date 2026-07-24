import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { VHSNoise } from "@/components/ui/vhs-noise";
import { CinemaLoadingDeck } from "@/components/cinema/cinema-effects";
import { ProfilePageHeader } from "@/domains/profiles/components/ProfilePageHeader";
import { ProfileIdentityCard } from "@/domains/profiles/components/ProfileIdentityCard";
import { RecentActivityCard } from "@/domains/profiles/components/RecentActivityCard";
import { ProfileNotFound } from "@/domains/profiles/components/ProfileNotFound";
import { ProfileForbidden } from "@/domains/profiles/components/ProfileForbidden";
import { useUserProfile } from "@/domains/profiles/hooks/useGetUserProfile";

export default function UserProfile() {
  const [, params] = useRoute<{ userId: string }>("/users/:userId");
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading } = useGetMe();

  const userId = params ? parseInt(params.userId, 10) : NaN;
  const { status, profile } = useUserProfile(Number.isFinite(userId) ? userId : undefined);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [userId]);

  useEffect(() => {
    if (!meLoading && !me) setLocation("/");
  }, [me, meLoading, setLocation]);

  const isSelf = !!me && !!profile && me.id === profile.id;

  if (status === "loading" || meLoading) {
    return (
      <div className="cinema-loading-page min-h-screen bg-background relative">
        <VHSNoise />
        <CinemaLoadingDeck destination="profile" />
      </div>
    );
  }

  return (
    <div className="cinema-route-page min-h-screen bg-background relative">
      <VHSNoise />
      <ProfilePageHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button
          onClick={() => setLocation("/dashboard")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3 h-3" /> Back to dashboard
        </button>

        {status === "notFound" && <ProfileNotFound />}
        {status === "forbidden" && <ProfileForbidden />}
        {status === "error" && (
          <div className="bg-card/50 border border-destructive/40 p-6 text-center text-destructive">
            <p className="font-bold mb-2">Something went wrong loading this profile.</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        )}
        {status === "ok" && profile && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
            <ProfileIdentityCard profile={profile} isSelf={isSelf} />
            <RecentActivityCard items={profile.recentActivity} />
          </div>
        )}
      </main>
    </div>
  );
}
