import { ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UserProfile } from "@workspace/api-client-react";
import { ProfilePictureDialog } from "./ProfilePictureDialog";

interface ProfileIdentityCardProps {
  profile: UserProfile;
  isSelf: boolean;
}

function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function ProfileIdentityCard({ profile, isSelf }: ProfileIdentityCardProps) {
  return (
    <div className="bg-card/50 border border-border/30 p-5 lg:p-6">
      {/* Mobile: avatar + identity inline. Desktop: stacked. */}
      <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-0">
        <ProfilePictureDialog avatarUrl={profile.avatarUrl} username={profile.username}>
          <button
            type="button"
            className="shrink-0 cursor-zoom-in transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:w-full"
            aria-label={`Enlarge ${profile.username}'s profile picture`}
          >
            <Avatar className="w-[72px] h-[72px] lg:w-full lg:h-auto lg:aspect-square border-2 border-primary lg:rounded-none">
              <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.username} />
              <AvatarFallback className="bg-primary text-secondary text-2xl lg:text-5xl font-black lg:rounded-none">
                {profile.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
        </ProfilePictureDialog>

        <div className="min-w-0 lg:mt-4">
          <h2 className="text-lg lg:text-2xl font-black text-foreground truncate">
            {profile.username}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isSelf && <span className="text-primary font-bold">You</span>}
            {isSelf && " · "}
            Member since {formatMemberSince(profile.createdAt)}
          </p>

          {profile.letterboxdUsername && (
            <a
              href={`https://letterboxd.com/${profile.letterboxdUsername}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 lg:mt-3 inline-flex items-center gap-2 bg-[#00C853]/10 border border-[#00C853] text-[#00E676] px-2.5 py-1.5 text-xs font-bold hover:bg-[#00C853]/20 transition"
            >
              <span className="w-2 h-2 bg-[#00E676] rounded-full" aria-hidden />
              letterboxd.com/{profile.letterboxdUsername}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Stats trio */}
      <div className="grid grid-cols-3 gap-1.5 mt-4 lg:mt-5">
        <Stat value={profile.stats.totalWatched.toString()} label="Watched" />
        <Stat value={profile.stats.avgRating.toFixed(1)} label="Avg ★" />
        <Stat value={profile.stats.totalReviews.toString()} label="Reviews" />
      </div>

      {/* Top genres (hide if empty) */}
      {profile.topGenres.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] tracking-[0.18em] uppercase text-primary font-black mb-2">
            Top Genres
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.topGenres.slice(0, 3).map((g) => (
              <span
                key={g}
                className="bg-secondary text-primary px-2.5 py-1 text-[11px] font-black uppercase tracking-wider"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-primary/[0.06] border border-primary/25 px-2 py-2.5 text-center">
      <div className="text-xl font-black text-primary leading-none">{value}</div>
      <div className="text-[9px] tracking-[0.12em] uppercase text-muted-foreground mt-1">
        {label}
      </div>
    </div>
  );
}
