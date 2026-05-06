import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfilePictureDialogProps {
  avatarUrl?: string | null;
  username: string;
  children: React.ReactNode;
}

export function ProfilePictureDialog({
  avatarUrl,
  username,
  children,
}: ProfilePictureDialogProps) {
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-[min(92vw,34rem)] border-border bg-background p-4 shadow-xl">
        <DialogTitle className="sr-only">{username}'s profile picture</DialogTitle>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${username}'s profile picture`}
            className="max-h-[78vh] w-full object-contain"
          />
        ) : (
          <Avatar className="mx-auto h-[min(78vw,28rem)] w-[min(78vw,28rem)] border border-border">
            <AvatarImage src={undefined} alt={username} />
            <AvatarFallback className="bg-secondary text-6xl font-semibold text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
      </DialogContent>
    </Dialog>
  );
}
