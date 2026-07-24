import { Check, Clock3, MoreVertical, Play, Shield, UserRound } from "lucide-react";
import type { Member } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserLink } from "@/domains/profiles/components/UserLink";

interface WatchStatusShelfProps {
  members: Member[];
  pickerUserId?: number | null;
  isAdminOrOwner: boolean;
  onAssignPicker: (userId: number) => void;
  onUpdateRole: (userId: number, role: string) => void;
  onKick: (userId: number) => void;
}

export function WatchStatusShelf({
  members,
  pickerUserId,
  isAdminOrOwner,
  onAssignPicker,
  onUpdateRole,
  onKick,
}: WatchStatusShelfProps) {
  return (
    <section className="watch-status-section" aria-labelledby="watch-status-heading">
      <div className="watch-status-heading-row">
        <div>
          <span className="watch-status-kicker">Club roster · All members</span>
          <h2 id="watch-status-heading" className="watch-status-heading">
            <UserRound aria-hidden="true" />
            Watch Status
          </h2>
        </div>
        <span className="watch-status-count" aria-label={`${members.length} members`}>
          {String(members.length).padStart(2, "0")} members
        </span>
      </div>

      {members.length > 0 ? (
        <div className="watch-status-shelf" role="list" aria-label="Member watch statuses">
          {members.map((member) => {
            const isPicker = pickerUserId === member.id;

            return (
              <article
                key={member.id}
                className={`watch-tape-card ${member.watched ? "is-watched" : "is-pending"}`}
                role="listitem"
              >
                <div className="watch-tape-card__header">
                  <UserLink userId={member.id} ariaLabel={`Open ${member.username}'s profile`}>
                    <Avatar className="watch-tape-card__avatar">
                      <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-primary text-secondary text-sm font-black">
                        {member.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </UserLink>

                  <div className="watch-tape-card__identity">
                    <UserLink userId={member.id} className="watch-tape-card__name">
                      {member.username}
                    </UserLink>
                    <div className="watch-tape-card__badges">
                      <span>{member.role}</span>
                      {isPicker && (
                        <span className="is-picker">
                          <Play aria-hidden="true" />
                          Picker
                        </span>
                      )}
                    </div>
                  </div>

                  {isAdminOrOwner && member.role !== "owner" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="watch-tape-card__menu"
                          aria-label={`Manage ${member.username}`}
                        >
                          <MoreVertical aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="vcr-dropdown">
                        <DropdownMenuItem onClick={() => onAssignPicker(member.id)}>
                          Make Picker
                        </DropdownMenuItem>
                        {member.role !== "admin" ? (
                          <DropdownMenuItem onClick={() => onUpdateRole(member.id, "admin")}>
                            Promote to Admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => onUpdateRole(member.id, "member")}>
                            Demote to Member
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onKick(member.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="watch-tape-card__status">
                  <span className="watch-tape-card__light" aria-hidden="true" />
                  {member.watched ? (
                    <>
                      <Check aria-hidden="true" />
                      Watched
                    </>
                  ) : (
                    <>
                      <Clock3 aria-hidden="true" />
                      Pending
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="watch-status-empty" role="status">
          <Shield aria-hidden="true" />
          No members are currently listed.
        </div>
      )}
    </section>
  );
}
