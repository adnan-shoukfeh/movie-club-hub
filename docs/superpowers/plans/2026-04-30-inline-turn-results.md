# Inline Turn Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the separate results page into the group turn view, showing results inline when a turn has completed.

**Architecture:** Create a new `TurnResultsInline` component that encapsulates score summary, distribution chart, member reviews, and shame dungeon. Conditionally render it in `group-detail.tsx` when `resultsAvailable` is true, hiding the Watch Status section. Convert the old results page to a redirect.

**Tech Stack:** React, TypeScript, Tailwind CSS, Recharts, Lucide icons, wouter routing

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `artifacts/movie-club/src/domains/verdicts/components/TurnResultsInline.tsx` | Create | Main inline results component with all sub-sections |
| `artifacts/movie-club/src/pages/group-detail.tsx` | Modify | Import TurnResultsInline, conditionally render, hide Watch Status |
| `artifacts/movie-club/src/domains/verdicts/components/VerdictList.tsx` | Delete | Replaced by TurnResultsInline |
| `artifacts/movie-club/src/domains/verdicts/components/RecentVerdictsList.tsx` | Modify | Change link target from results page to group view |
| `artifacts/movie-club/src/pages/group-results.tsx` | Modify | Convert to redirect component |

---

### Task 1: Create TurnResultsInline Component

**Files:**
- Create: `artifacts/movie-club/src/domains/verdicts/components/TurnResultsInline.tsx`

- [ ] **Step 1: Create the component file with imports and types**

```tsx
import { useState } from "react";
import { useGetVerdicts, getGetResultsQueryKey } from "@workspace/api-client-react";
import type { Member } from "@workspace/api-client-react";
import {
  Star,
  Award,
  Users,
  TrendingUp,
  User,
  Skull,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ReactionBar } from "@/domains/reactions";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface TurnResultsInlineProps {
  groupId: number;
  selectedWeek: string;
  members: Member[];
}

function convertTo5StarRating(rating10: number): number {
  const raw = rating10 / 2;
  return Math.round(raw * 4) / 4;
}

function FiveStarDisplay({ rating }: { rating: number }) {
  const displayRating = convertTo5StarRating(rating);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = Math.min(Math.max(displayRating - (star - 1), 0), 1) * 100;

        return (
          <div key={star} className="relative w-4 h-4">
            <Star className="w-4 h-4 text-white/20 absolute" />
            <div
              className="absolute overflow-hidden"
              style={{ width: `${fillPercent}%` }}
            >
              <Star className="w-4 h-4 fill-primary text-primary" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add the main component with data fetching**

Add below the helper functions:

```tsx
export function TurnResultsInline({ groupId, selectedWeek, members }: TurnResultsInlineProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(true);

  const { data: results, isLoading, error } = useGetVerdicts(
    groupId,
    { weekOf: selectedWeek },
    {
      query: {
        queryKey: [...getGetResultsQueryKey(groupId), selectedWeek],
        enabled: !!groupId && !!selectedWeek,
      },
    }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="border-4 border-secondary bg-card p-8 text-center">
        <Award className="w-12 h-12 text-secondary/50 mx-auto mb-3" />
        <p className="text-white font-bold uppercase">Results unavailable</p>
      </div>
    );
  }

  const maxCount = Math.max(...results.distribution.map((d) => d.count), 1);

  // Determine who didn't submit a rating (shame dungeon members)
  const voterUsernames = new Set(results.votes.map((v) => v.username));
  const shameDungeonMembers = members.filter((m) => !voterUsernames.has(m.username));

  // TODO: Add sorting/filtering options for reviews
  // Options to consider: by rating, by reaction count, by submission time
  // See design doc: docs/superpowers/specs/2026-04-30-inline-turn-results-design.md
  const sortedVotes = [...results.votes].sort((a, b) => b.rating - a.rating);

  return (
    <div className="space-y-6">
      {/* Collapsible Results Summary */}
      <div className="border-8 border-primary bg-secondary">
        <button
          onClick={() => setSummaryExpanded(!summaryExpanded)}
          className="w-full p-6 flex items-center justify-between hover:bg-secondary/80 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary flex items-center justify-center">
              <Award className="w-7 h-7 text-secondary" />
            </div>
            <h3 className="text-2xl font-black text-primary uppercase">Final Results</h3>
          </div>
          {summaryExpanded ? (
            <ChevronUp className="w-6 h-6 text-primary" />
          ) : (
            <ChevronDown className="w-6 h-6 text-primary" />
          )}
        </button>

        {summaryExpanded && (
          <div className="px-6 pb-6 space-y-6">
            {/* Score cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 bg-card border-4 border-primary">
                <p className="text-sm font-black text-primary mb-3 uppercase tracking-widest">
                  Average Rating
                </p>
                <div className="flex items-center gap-3">
                  <Star className="w-8 h-8 fill-primary text-primary" />
                  <span className="text-5xl font-black text-white">
                    {results.averageRating}
                  </span>
                  <span className="text-xl text-white/60 mt-2 font-bold">/10</span>
                </div>
              </div>

              <div className="p-6 bg-card border-4 border-white/30">
                <p className="text-sm font-black text-white mb-3 uppercase tracking-widest">
                  Participation
                </p>
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary" />
                  <span className="text-5xl font-black text-white">
                    {results.totalVotes}
                  </span>
                  <span className="text-xl text-white/60 mt-2 font-bold">votes</span>
                </div>
              </div>
            </div>

            {/* Distribution chart */}
            <div className="border-4 border-card bg-card p-4">
              <h4 className="font-black text-primary mb-4 text-lg flex items-center gap-2 uppercase">
                <TrendingUp className="w-5 h-5" />
                Rating Distribution
              </h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={results.distribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="rating"
                    tick={{ fontSize: 12, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,48,135,0.3)" }}
                    contentStyle={{
                      background: "#001d3d",
                      border: "4px solid #003087",
                      borderRadius: "0",
                      fontSize: "12px",
                      color: "#ffffff",
                    }}
                    formatter={(value: number) => [`${value} rating${value !== 1 ? "s" : ""}`, ""]}
                    labelFormatter={(label) => `Rating: ${label}/10`}
                  />
                  <Bar dataKey="count" radius={0}>
                    {results.distribution.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.count === maxCount && entry.count > 0
                            ? "#FDB913"
                            : entry.count > 0
                            ? "#003087"
                            : "#001d3d"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Member Reviews */}
      {sortedVotes.length > 0 && (
        <div className="border-4 border-secondary bg-card p-6">
          <h4 className="font-black text-primary mb-6 text-xl flex items-center gap-3 uppercase pb-4 border-b-4 border-secondary">
            <Star className="w-6 h-6 fill-primary" />
            Member Reviews
          </h4>

          <div className="space-y-4">
            {(sortedVotes as Array<typeof sortedVotes[number] & { id?: number }>).map((vote, i) => (
              <div
                key={vote.id ?? i}
                className="p-5 bg-secondary border-l-8 border-primary"
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-12 h-12 bg-primary flex items-center justify-center">
                    <User className="w-6 h-6 text-secondary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-white mb-2 text-lg">{vote.username}</p>
                    <div className="flex items-center gap-2 mb-2">
                      <FiveStarDisplay rating={vote.rating} />
                      <span className="px-3 py-1 bg-primary border-2 border-card font-black text-secondary text-sm">
                        {vote.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
                {vote.review && (
                  <p className="text-sm text-white leading-relaxed pl-16 mt-2 border-t-2 border-white/20 pt-3 italic">
                    "{vote.review}"
                  </p>
                )}
                {vote.id && (
                  <div className="pl-16 mt-3">
                    <ReactionBar
                      entityType="verdict"
                      entityId={vote.id}
                      groupId={groupId}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shame Dungeon */}
      {shameDungeonMembers.length > 0 && (
        <div className="border-4 border-secondary bg-card p-6">
          <h4 className="font-black text-primary mb-4 text-xl flex items-center gap-2 uppercase">
            <Skull className="w-6 h-6" />
            Shame Dungeon
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {shameDungeonMembers.map((member) => (
              <div key={member.id} className="p-3 bg-secondary border-2 border-white/20 opacity-50">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-primary flex items-center justify-center">
                    <User className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{member.username}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd artifacts/movie-club && npx tsc --noEmit`
Expected: No errors related to TurnResultsInline.tsx

- [ ] **Step 4: Commit**

```bash
git add artifacts/movie-club/src/domains/verdicts/components/TurnResultsInline.tsx
git commit -m "$(cat <<'EOF'
feat: add TurnResultsInline component

Encapsulates inline results display with:
- Collapsible score summary (average rating, participation, distribution chart)
- Member reviews sorted by rating descending
- Shame Dungeon for non-participants
EOF
)"
```

---

### Task 2: Update group-detail.tsx to Use TurnResultsInline

**Files:**
- Modify: `artifacts/movie-club/src/pages/group-detail.tsx`

- [ ] **Step 1: Add import for TurnResultsInline**

At the top of `group-detail.tsx`, add this import alongside existing imports:

```tsx
import { TurnResultsInline } from "@/domains/verdicts/components/TurnResultsInline";
```

- [ ] **Step 2: Remove VerdictList import**

Remove this line from the imports:

```tsx
import { VerdictList } from "@/domains/verdicts/components/VerdictList";
```

- [ ] **Step 3: Replace VerdictList with TurnResultsInline**

Find the VerdictList usage (around line 273):

```tsx
<VerdictList
  groupId={groupId}
  group={group}
  status={status}
  selectedWeek={selectedWeek}
/>
```

Replace it with:

```tsx
{group.resultsAvailable && (
  <TurnResultsInline
    groupId={groupId}
    selectedWeek={selectedWeek}
    members={group.members}
  />
)}
```

- [ ] **Step 4: Wrap Watch Status section with conditional**

Find the Watch Status section (starts around line 280 with `{/* Watch Status / Members */}`):

```tsx
{/* Watch Status / Members */}
<div className="p-6 mb-6">
  <h3 className="font-black text-primary mb-4 text-xl flex items-center gap-2 uppercase">
```

Wrap the entire section with a conditional:

```tsx
{/* Watch Status / Members - only shown when results not available */}
{!group.resultsAvailable && (
  <div className="p-6 mb-6">
    <h3 className="font-black text-primary mb-4 text-xl flex items-center gap-2 uppercase">
      <User className="w-6 h-6" />
      Watch Status
    </h3>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {group.members.map((member) => {
        const watched = member.watched;
        const isPicker = status?.pickerUserId === member.id;

        return (
          <div key={member.id} className="p-3 bg-secondary border-2 border-white/20 relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-primary flex items-center justify-center">
                <User className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{member.username}</p>
                {isPicker && (
                  <span className="text-xs text-primary font-bold uppercase">Picker</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs">
              {watched ? (
                <div className="flex items-center gap-1 text-primary font-bold">
                  <Check className="w-3 h-3" />
                  Watched
                </div>
              ) : (
                <div className="flex items-center gap-1 text-white/50 font-bold">
                  <Clock className="w-3 h-3" />
                  Pending
                </div>
              )}
            </div>
            {/* Admin actions */}
            {isAdminOrOwner && member.role !== "owner" && (
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => setShowMemberActions(showMemberActions === member.id ? null : member.id)}
                  className="p-1 text-white/50 hover:text-primary transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showMemberActions === member.id && (
                  <div className="absolute right-0 top-full mt-1 bg-card border-4 border-secondary shadow-xl z-20 min-w-36">
                    <button
                      className="w-full text-left text-xs px-3 py-2 text-white hover:bg-secondary font-bold uppercase transition-colors"
                      onClick={() => handleAssignPicker(member.id)}
                    >
                      Make Picker
                    </button>
                    {member.role !== "admin" && (
                      <button
                        className="w-full text-left text-xs px-3 py-2 text-white hover:bg-secondary font-bold uppercase transition-colors"
                        onClick={() => handleUpdateRole(member.id, "admin")}
                      >
                        Promote
                      </button>
                    )}
                    {member.role === "admin" && (
                      <button
                        className="w-full text-left text-xs px-3 py-2 text-white hover:bg-secondary font-bold uppercase transition-colors"
                        onClick={() => handleUpdateRole(member.id, "member")}
                      >
                        Demote
                      </button>
                    )}
                    <button
                      className="w-full text-left text-xs px-3 py-2 text-destructive hover:bg-secondary font-bold uppercase transition-colors"
                      onClick={() => handleKick(member.id)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify the file compiles**

Run: `cd artifacts/movie-club && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add artifacts/movie-club/src/pages/group-detail.tsx
git commit -m "$(cat <<'EOF'
feat: integrate TurnResultsInline into group detail page

- Show inline results when resultsAvailable is true
- Hide Watch Status section when results are available
- Remove VerdictList usage (replaced by inline results)
EOF
)"
```

---

### Task 3: Delete VerdictList Component

**Files:**
- Delete: `artifacts/movie-club/src/domains/verdicts/components/VerdictList.tsx`

- [ ] **Step 1: Delete the VerdictList.tsx file**

```bash
rm artifacts/movie-club/src/domains/verdicts/components/VerdictList.tsx
```

- [ ] **Step 2: Check for any remaining imports**

Run: `grep -r "VerdictList" artifacts/movie-club/src --include="*.tsx" --include="*.ts"`
Expected: No results (all imports should have been removed in Task 2)

- [ ] **Step 3: Verify the project compiles**

Run: `cd artifacts/movie-club && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove VerdictList component (replaced by TurnResultsInline)"
```

---

### Task 4: Update RecentVerdictsList Links

**Files:**
- Modify: `artifacts/movie-club/src/domains/verdicts/components/RecentVerdictsList.tsx`

- [ ] **Step 1: Update the navigation target**

In `RecentVerdictsList.tsx`, find the onClick handler (around line 27):

```tsx
onClick={() => setLocation(`/groups/${result.groupId}/results?weekOf=${result.weekOf}`)}
```

Change it to:

```tsx
onClick={() => setLocation(`/groups/${result.groupId}?weekOf=${result.weekOf}`)}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd artifacts/movie-club && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add artifacts/movie-club/src/domains/verdicts/components/RecentVerdictsList.tsx
git commit -m "fix: update Recently Watched links to go to group view"
```

---

### Task 5: Convert group-results.tsx to Redirect

**Files:**
- Modify: `artifacts/movie-club/src/pages/group-results.tsx`

- [ ] **Step 1: Replace the entire file content**

Replace the entire contents of `group-results.tsx` with:

```tsx
import { useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";

export default function GroupResults() {
  const params = useParams<{ groupId: string }>();
  const search = useSearch();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const qp = new URLSearchParams(search);
    const weekOf = qp.get("weekOf");
    const target = weekOf
      ? `/groups/${params.groupId}?weekOf=${weekOf}`
      : `/groups/${params.groupId}`;
    setLocation(target, { replace: true });
  }, [params.groupId, search, setLocation]);

  return null;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd artifacts/movie-club && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add artifacts/movie-club/src/pages/group-results.tsx
git commit -m "refactor: convert results page to redirect for backwards compatibility"
```

---

### Task 6: Manual Testing

**Files:**
- None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `cd artifacts/movie-club && pnpm dev`

- [ ] **Step 2: Test inline results display**

1. Navigate to a group with a completed turn (resultsAvailable = true)
2. Verify: Score summary with average rating and participation is visible
3. Verify: Distribution chart is visible
4. Verify: Member reviews are listed, sorted by rating (highest first)
5. Verify: Shame Dungeon shows members who didn't submit ratings
6. Verify: Watch Status section is NOT visible

- [ ] **Step 3: Test collapsible behavior**

1. Click the "Final Results" header
2. Verify: Score cards and distribution chart collapse
3. Click again
4. Verify: They expand back

- [ ] **Step 4: Test admin re-open flow**

1. As an admin, re-open voting for a completed turn
2. Navigate to that turn
3. Verify: VerdictForm appears above the inline results
4. Verify: Inline results still display below the form

- [ ] **Step 5: Test redirect**

1. Navigate directly to `/groups/1/results?weekOf=2026-04-11`
2. Verify: Redirected to `/groups/1?weekOf=2026-04-11`
3. Verify: Results display inline on the group page

- [ ] **Step 6: Test dashboard links**

1. Go to dashboard
2. Click a movie in "Recently Watched"
3. Verify: Navigates to `/groups/:id?weekOf=...` (not `/groups/:id/results?weekOf=...`)
4. Verify: Results display inline

- [ ] **Step 7: Test guard - results not available**

1. Navigate to a group with a turn where results are NOT yet available
2. Verify: Inline results do NOT render
3. Verify: Watch Status section IS visible

- [ ] **Step 8: Commit any fixes if needed**

If issues found, fix and commit with descriptive message.

---

### Task 7: Final Verification

- [ ] **Step 1: Run type check**

Run: `cd artifacts/movie-club && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `cd artifacts/movie-club && pnpm lint`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 3: Build for production**

Run: `cd artifacts/movie-club && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Final commit if any cleanup needed**

If any fixes were made during verification:
```bash
git add -A
git commit -m "chore: cleanup and fix lint issues"
```
