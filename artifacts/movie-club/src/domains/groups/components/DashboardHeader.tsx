import { Film, LogOut, Settings } from "lucide-react";

interface DashboardHeaderProps {
  username?: string;
  onProfile: () => void;
  onLogout: () => void;
}

export function DashboardHeader({ username, onProfile, onLogout }: DashboardHeaderProps) {
  return (
    <header className="border-b-4 border-primary sticky top-0 z-10 bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary flex items-center justify-center">
              <Film className="w-7 h-7 text-secondary" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary tracking-tight">
                MOVIE CLUBS
              </h1>
              <p className="text-sm text-white/80">
                {username ? `Welcome back, ${username}` : "Your cinematic journey"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onProfile}
              className="p-2.5 border-2 border-white/30 hover:border-primary bg-secondary text-white hover:text-primary transition-all"
              title="Profile settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 border-2 border-white/30 hover:border-primary bg-secondary text-white hover:text-primary transition-all font-bold uppercase text-sm flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
