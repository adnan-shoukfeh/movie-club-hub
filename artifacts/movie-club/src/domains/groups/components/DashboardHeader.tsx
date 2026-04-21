import { Film, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  username?: string;
  onProfile: () => void;
  onLogout: () => void;
}

export function DashboardHeader({ username, onProfile, onLogout }: DashboardHeaderProps) {
  return (
    <header className="border-b border-border/40 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Film className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="font-serif font-semibold text-foreground">Movie Club</span>
            {username && (
              <span className="text-muted-foreground text-sm ml-2">· {username}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onProfile}
            className="text-muted-foreground hover:text-foreground"
            title="Profile settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Out
          </Button>
        </div>
      </div>
    </header>
  );
}
