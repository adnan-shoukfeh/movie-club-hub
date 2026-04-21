import { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiCall, ConfirmDialog } from "./shared";

interface GroupSettingsFormProps {
  groupId: number;
  initialStartDate: string;
  initialTurnLengthDays: number;
  isExpanded: boolean;
  onToggle: () => void;
  onMutate: () => void;
}

export function GroupSettingsForm({
  groupId,
  initialStartDate,
  initialTurnLengthDays,
  isExpanded,
  onToggle,
  onMutate,
}: GroupSettingsFormProps) {
  const { toast } = useToast();
  const [settingsStartDate, setSettingsStartDate] = useState<string>(initialStartDate);
  const [settingsTurnLength, setSettingsTurnLength] = useState<string>(String(initialTurnLengthDays));
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsDateOpen, setSettingsDateOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void; variant?: "destructive" | "warning" } | null>(null);

  useEffect(() => {
    setSettingsStartDate(initialStartDate);
    setSettingsTurnLength(String(initialTurnLengthDays));
  }, [initialStartDate, initialTurnLengthDays]);

  const withConfirm = (message: string, action: () => void, variant: "destructive" | "warning" = "destructive") => {
    setConfirm({ message, action, variant });
  };

  const handleSaveSettings = async () => {
    if (!settingsStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(settingsStartDate)) {
      toast({ title: "Invalid start date", description: "Please enter a valid date (YYYY-MM-DD)", variant: "destructive" });
      return;
    }
    const days = parseInt(settingsTurnLength, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      toast({ title: "Invalid turn length", description: "Turn length must be between 1 and 365 days", variant: "destructive" });
      return;
    }
    withConfirm(
      "Changing the start date or turn length will shift all turn boundaries going forward. Existing votes and movies are not moved. Are you sure?",
      async () => {
        setSettingsSaving(true);
        try {
          await apiCall(`/api/admin/groups/${groupId}/settings`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startDate: settingsStartDate, turnLengthDays: days }),
          });
          toast({ title: "Group settings saved" });
          onMutate();
        } catch (e: unknown) {
          toast({ title: "Error", description: e instanceof Error ? e.message : "Request failed", variant: "destructive" });
        } finally {
          setSettingsSaving(false);
        }
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
            <CalendarIcon2 className="w-4 h-4 text-primary" />
            <span className="font-serif font-semibold text-foreground">Group Settings</span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {isExpanded && (
          <div className="border-t border-border/20 p-4 space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs text-yellow-400 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Changing the start date or turn length shifts all turn boundaries going forward. Existing votes and movies are not re-keyed.</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Group Start Date</label>
                <Popover open={settingsDateOpen} onOpenChange={setSettingsDateOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-9 text-sm rounded-md bg-background border border-border px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-xs flex items-center gap-2 text-left"
                    >
                      <CalendarIcon2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {settingsStartDate
                        ? new Date(settingsStartDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : <span className="text-muted-foreground/60">Pick a date</span>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={settingsStartDate ? new Date(settingsStartDate + "T00:00:00") : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const y = date.getFullYear();
                          const m = String(date.getMonth() + 1).padStart(2, "0");
                          const d = String(date.getDate()).padStart(2, "0");
                          setSettingsStartDate(`${y}-${m}-${d}`);
                          setSettingsDateOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground/60 mt-1">The date when turn 1 began</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Turn Length (days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={settingsTurnLength}
                  onChange={(e) => setSettingsTurnLength(e.target.value)}
                  className="h-9 w-24 text-sm rounded-md bg-background border border-border px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground/60 mt-1">Default length for each turn in days</p>
              </div>

              <Button
                size="sm"
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="bg-primary hover:bg-primary/90"
              >
                {settingsSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
