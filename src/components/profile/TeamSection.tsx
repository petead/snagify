"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, X, Mail, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatProfileRoleLabel, normalizeProfileRole } from "@/lib/profileLabels";

interface Member {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  avatar_url?: string | null;
}

interface Invitation {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
}

interface Props {
  company: { id: string; plan: string; max_users: number; name: string };
  currentUserId: string;
}

export function TeamSection({ company, currentUserId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteDone, setInviteDone] = useState(false);

  useEffect(() => {
    void loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  async function loadTeam() {
    setLoading(true);
    const supabase = createClient();

    const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, avatar_url")
        .eq("company_id", company.id),
      supabase
        .from("company_invitations")
        .select("id, email, created_at, expires_at")
        .eq("company_id", company.id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString()),
    ]);

    setMembers((memberRows as Member[]) ?? []);
    setInvitations((inviteRows as Invitation[]) ?? []);
    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);

    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = (await res.json()) as { error?: string; success?: boolean };

    if (data.error) {
      setInviteError(data.error);
      setInviting(false);
      return;
    }

    setInviteDone(true);
    setInviteEmail("");
    await loadTeam();
    setInviting(false);
    setTimeout(() => setInviteDone(false), 3000);
  }

  async function handleRemove(userId: string) {
    if (!window.confirm("Remove this inspector from your team?")) return;
    try {
      await fetch(`/api/team/${userId}`, { method: "DELETE" });
      await loadTeam();
    } catch (err) {
      console.error("Failed to remove team member:", err);
    }
  }

  async function handleCancelInvite(inviteId: string) {
    try {
      await fetch(`/api/team/invite/${inviteId}`, { method: "DELETE" });
      await loadTeam();
    } catch (err) {
      console.error("Failed to cancel invite:", err);
    }
  }

  const maxUsers = company.max_users || 1;
  const atCapacity = members.length >= maxUsers;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
      <div className="px-4 py-3 bg-[#EDE9FF] border-b border-[#DDD6FE] flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold text-[#9A88FD] uppercase tracking-wide">Team</div>
          <div className="text-[15px] font-bold text-[#1A1A2E] mt-0.5">
            {members.length}
            {maxUsers < 999 ? `/${maxUsers}` : ""} members
          </div>
        </div>
        {atCapacity && maxUsers < 999 && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
            Plan limit reached
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-[#9A88FD]" />
          </div>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-[#EDE9FF] flex items-center justify-center text-[12px] font-bold text-[#9A88FD] flex-shrink-0 overflow-hidden">
                {m.avatar_url ? (
                  <img src={m.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                ) : (
                  (m.full_name ?? "")
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "?"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1A1A2E] truncate">
                  {m.full_name || "Unnamed"}
                  {m.id === currentUserId && (
                    <span className="text-[10px] text-[#9A88FD] ml-1.5">(you)</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 truncate">{m.email || "—"}</div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  m.role === "owner" ? "bg-[#EDE9FF] text-[#9A88FD]" : "bg-[#F3F3F8] text-[#6B7280]"
                }`}
              >
                {formatProfileRoleLabel(normalizeProfileRole(m.role))}
              </span>
              {m.role !== "owner" && m.id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => void handleRemove(m.id)}
                  className="w-7 h-7 rounded-lg bg-[#FEF2F2] flex items-center justify-center flex-shrink-0"
                >
                  <X size={12} color="#EF4444" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {invitations.length > 0 && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          <div className="px-4 py-2">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Pending invitations
            </span>
          </div>
          {invitations.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Clock size={14} color="#D97706" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1A1A2E] truncate">{inv.email}</div>
                <div className="text-[11px] text-amber-600">
                  Invited · expires{" "}
                  {new Date(inv.expires_at).toLocaleDateString("en-AE", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCancelInvite(inv.id)}
                className="w-7 h-7 rounded-lg bg-[#FEF2F2] flex items-center justify-center flex-shrink-0"
              >
                <X size={12} color="#EF4444" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-100 p-4">
        {atCapacity && maxUsers < 999 ? (
          <div className="text-center py-2">
            <p className="text-[12px] text-gray-500 mb-2">You&apos;ve reached the limit for your plan.</p>
            <button type="button" className="text-[12px] font-semibold text-[#9A88FD]">
              Upgrade to add more members →
            </button>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="flex gap-2">
            <div className="flex-1 relative">
              <Mail
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError(null);
                }}
                placeholder="inspector@agency.com"
                required
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[13px] outline-none focus:border-[#9A88FD] focus:bg-white transition-all"
                style={{ fontSize: "16px" }}
              />
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail}
              className="flex items-center gap-1.5 bg-[#9A88FD] text-white rounded-xl px-4 py-2.5 text-[13px] font-bold disabled:opacity-50 flex-shrink-0"
            >
              {inviting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : inviteDone ? (
                "✓ Sent!"
              ) : (
                <>
                  <UserPlus size={13} /> Invite
                </>
              )}
            </button>
          </form>
        )}

        {inviteError && <p className="text-[12px] text-red-500 mt-2">{inviteError}</p>}
      </div>
    </div>
  );
}
