import { useState } from "react";
import { Link, useParams } from "react-router";
import { clubs, users, currentUserId } from "../data/mockData";
import { ArrowLeft, Lock, Unlock, Users, Calendar, Settings as SettingsIcon, Shield } from "lucide-react";
import { VHSNoise } from "./VHSNoise";

export function AdminPanel() {
  const { clubId } = useParams();
  const club = clubs[clubId!];
  const [activeTab, setActiveTab] = useState<"settings" | "roles">("settings");

  if (!club) return <div>Club not found</div>;

  const isOwner = club.ownerId === currentUserId;

  return (
    <div className="min-h-screen bg-[#000814] relative">
      <VHSNoise />
      <header className="border-b-4 border-[#FDB913] sticky top-0 z-10 bg-[#003087]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link to={`/club/${clubId}`} className="text-white hover:text-[#FDB913] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FDB913] flex items-center justify-center">
              <Shield className="w-7 h-7 text-[#003087]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#FDB913] uppercase">Admin Panel</h1>
              <p className="text-sm text-white/80">{club.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 px-6 py-4 font-black uppercase transition-all border-4 ${
              activeTab === "settings"
                ? "bg-[#FDB913] text-[#003087] border-[#003087]"
                : "bg-[#001d3d] text-white border-[#003087] hover:border-[#FDB913]"
            }`}
          >
            <SettingsIcon className="w-5 h-5 inline mr-2" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab("roles")}
            className={`flex-1 px-6 py-4 font-black uppercase transition-all border-4 ${
              activeTab === "roles"
                ? "bg-[#FDB913] text-[#003087] border-[#003087]"
                : "bg-[#001d3d] text-white border-[#003087] hover:border-[#FDB913]"
            }`}
          >
            <Users className="w-5 h-5 inline mr-2" />
            Roles
          </button>
        </div>

        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="border-4 border-[#003087] bg-[#001d3d] p-6">
              <h3 className="font-black text-[#FDB913] mb-6 text-2xl flex items-center gap-3 uppercase pb-4 border-b-4 border-[#003087]">
                <Lock className="w-7 h-7" />
                Lock Controls
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-5 bg-[#003087] border-4 border-white/20">
                  <div>
                    <p className="font-bold text-white mb-1 uppercase">Movie Selection</p>
                    <p className="text-sm text-white/70 font-medium">
                      Prevent pickers from changing movie selection
                    </p>
                  </div>
                  <button
                    className={`px-6 py-3 font-black uppercase border-4 transition-all ${
                      club.settings.selectionLocked
                        ? "bg-[#001d3d] text-red-400 border-red-400"
                        : "bg-[#FDB913] text-[#003087] border-[#FDB913]"
                    }`}
                  >
                    {club.settings.selectionLocked ? (
                      <>
                        <Lock className="w-4 h-4 inline mr-2" />
                        Locked
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4 inline mr-2" />
                        Unlocked
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between p-5 bg-[#003087] border-4 border-white/20">
                  <div>
                    <p className="font-bold text-white mb-1 uppercase">Review Window</p>
                    <p className="text-sm text-white/70 font-medium">
                      Lock/unlock ability to submit ratings after turn ends
                    </p>
                  </div>
                  <button
                    className={`px-6 py-3 font-black uppercase border-4 transition-all ${
                      club.settings.reviewWindowLocked
                        ? "bg-[#001d3d] text-red-400 border-red-400"
                        : "bg-[#FDB913] text-[#003087] border-[#FDB913]"
                    }`}
                  >
                    {club.settings.reviewWindowLocked ? (
                      <>
                        <Lock className="w-4 h-4 inline mr-2" />
                        Locked
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4 inline mr-2" />
                        Unlocked
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-4 border-[#003087] bg-[#001d3d] p-6">
              <h3 className="font-black text-[#FDB913] mb-6 text-2xl flex items-center gap-3 uppercase pb-4 border-b-4 border-[#003087]">
                <Calendar className="w-7 h-7" />
                Turn Management
              </h3>
              <div className="space-y-3">
                <button className="w-full px-6 py-4 bg-[#003087] text-white text-left font-black uppercase border-4 border-white/20 hover:border-[#FDB913] transition-all">
                  Adjust Turn Schedule
                </button>
                <button className="w-full px-6 py-4 bg-[#003087] text-white text-left font-black uppercase border-4 border-white/20 hover:border-[#FDB913] transition-all">
                  Change Turn Picker
                </button>
                <button className="w-full px-6 py-4 bg-[#003087] text-white text-left font-black uppercase border-4 border-white/20 hover:border-[#FDB913] transition-all">
                  Modify Turn Movie
                </button>
              </div>
            </div>

            <div className="border-4 border-[#003087] bg-[#001d3d] p-6">
              <h3 className="font-black text-[#FDB913] mb-6 text-2xl flex items-center gap-3 uppercase pb-4 border-b-4 border-[#003087]">
                <SettingsIcon className="w-7 h-7" />
                Club Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-white mb-2 uppercase tracking-widest">
                    Club Name
                  </label>
                  <input
                    type="text"
                    defaultValue={club.name}
                    className="w-full px-4 py-3 border-4 border-[#003087] bg-[#001d3d] text-white focus:outline-none focus:border-[#FDB913] font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-white mb-2 uppercase tracking-widest">
                    Description
                  </label>
                  <textarea
                    defaultValue={club.description}
                    className="w-full px-4 py-3 border-4 border-[#003087] bg-[#001d3d] text-white focus:outline-none focus:border-[#FDB913] font-medium"
                    rows={3}
                  />
                </div>
                <button className="px-8 py-3 bg-[#FDB913] text-[#003087] border-4 border-[#003087] hover:bg-[#003087] hover:text-[#FDB913] hover:border-[#FDB913] transition-all font-black uppercase">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "roles" && (
          <div className="border-4 border-[#003087] bg-[#001d3d] p-6">
            <h3 className="font-black text-[#FDB913] mb-6 text-2xl uppercase pb-4 border-b-4 border-[#003087]">Member Roles</h3>
            <div className="space-y-3">
              {club.memberIds.map((memberId) => {
                const member = users[memberId];
                const isAdmin = club.adminIds.includes(memberId);
                const isMemberOwner = club.ownerId === memberId;

                return (
                  <div
                    key={memberId}
                    className="flex items-center justify-between p-4 border-4 border-[#003087] bg-[#003087]"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-12 h-12 rounded-full border-4 border-[#FDB913]"
                      />
                      <div>
                        <p className="font-bold text-white">{member.name}</p>
                        <div className="flex gap-2 mt-1">
                          {isMemberOwner && (
                            <span className="px-3 py-1 bg-[#FDB913] text-[#003087] text-xs border-2 border-[#003087] font-black uppercase">
                              Owner
                            </span>
                          )}
                          {isAdmin && !isMemberOwner && (
                            <span className="px-3 py-1 bg-[#FDB913] text-[#003087] text-xs border-2 border-[#003087] font-black uppercase">
                              Admin
                            </span>
                          )}
                          {!isAdmin && !isMemberOwner && (
                            <span className="px-3 py-1 bg-[#001d3d] text-white text-xs border-2 border-white/30 font-black uppercase">
                              Member
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isOwner && !isMemberOwner && (
                      <select
                        defaultValue={isAdmin ? "admin" : "member"}
                        className="px-4 py-2 border-4 border-white/30 text-sm bg-[#001d3d] text-white focus:outline-none focus:border-[#FDB913] font-bold uppercase"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            {isOwner && (
              <div className="mt-6 pt-6 border-t-4 border-[#003087]">
                <h4 className="font-black text-white mb-2 uppercase">Transfer Ownership</h4>
                <p className="text-sm text-white/70 mb-4 font-medium">
                  Transfer club ownership to another member. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <select className="flex-1 px-4 py-3 border-4 border-[#003087] text-sm bg-[#001d3d] text-white focus:outline-none focus:border-[#FDB913] font-bold uppercase">
                    <option>Select new owner...</option>
                    {club.memberIds
                      .filter((id) => id !== currentUserId)
                      .map((id) => (
                        <option key={id} value={id}>
                          {users[id].name}
                        </option>
                      ))}
                  </select>
                  <button className="px-6 py-3 bg-[#001d3d] text-red-400 border-4 border-red-400 hover:bg-red-400 hover:text-[#001d3d] font-black uppercase transition-all">
                    Transfer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
