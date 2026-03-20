"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, UserPlus, X, Mail, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatProfileRoleLabel, normalizeProfileRole } from "@/lib/profileLabels";

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  avatar_url?: string | null;
  job_title?: string | null;
  account_type?: "pro" | "individual" | null;
  created_at?: string | null;
  propertiesCount: number;
  inspectionsCount: number;
  reportsCount: number;
  isCurrentUser: boolean;
  displayRole: "Owner" | "Inspector";
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
  const supabase = createClient();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteDone, setInviteDone] = useState(false);

  const fetchTeamMembers = useCallback(async () => {
    if (!company.id) return;
    setLoading(true);

    const [{ data: members }, { data: inviteRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, avatar_url, job_title, account_type, created_at")
        .eq("company_id", company.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("company_invitations")
        .select("id, email, created_at, expires_at")
        .eq("company_id", company.id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString()),
    ]);

    if (!members) {
      setTeamMembers([]);
      setInvitations((inviteRows as Invitation[]) ?? []);
      setLoading(false);
      return;
    }

    const membersWithStats: TeamMember[] = await Promise.all(
      members.map(async (member) => {
        const [{ count: propertiesCount }, { count: inspectionsCount }, { count: reportsCount }] =
          await Promise.all([
            supabase.from("properties").select("id", { count: "exact", head: true }).eq("agent_id", member.id),
            supabase.from("inspections").select("id", { count: "exact", head: true }).eq("agent_id", member.id),
            supabase
              .from("inspections")
              .select("id", { count: "exact", head: true })
              .eq("agent_id", member.id)
              .not("report_url", "is", null),
          ]);

        const normalizedRole = normalizeProfileRole(member.role);
        return {
          ...member,
          propertiesCount: propertiesCount ?? 0,
          inspectionsCount: inspectionsCount ?? 0,
          reportsCount: reportsCount ?? 0,
          isCurrentUser: member.id === currentUserId,
          displayRole: normalizedRole === "owner" ? "Owner" : "Inspector",
        };
      })
    );

    setTeamMembers(membersWithStats);
    setInvitations((inviteRows as Invitation[]) ?? []);
    setLoading(false);
  }, [company.id, currentUserId, supabase]);

  useEffect(() => {
    void fetchTeamMembers();

    if (!company.id) return;
    const channel = supabase
      .channel(`team-${company.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          void fetchTeamMembers();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [company.id, fetchTeamMembers, supabase]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);

    const res = await fetch("/api/invite", {
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
    await fetchTeamMembers();
    setInviting(false);
    setTimeout(() => setInviteDone(false), 3000);
  }

  async function handleRemove(userId: string) {
    if (!window.confirm("Remove this inspector from your team?")) return;
    try {
      await fetch(`/api/team/${userId}`, { method: "DELETE" });
      await fetchTeamMembers();
    } catch (err) {
      console.error("Failed to remove team member:", err);
    }
  }

  async function handleCancelInvite(inviteId: string) {
    try {
      await fetch(`/api/team/invite/${inviteId}`, { method: "DELETE" });
      await fetchTeamMembers();
    } catch (err) {
      console.error("Failed to cancel invite:", err);
    }
  }

  const maxUsers = company.max_users || 1;
  const memberCount = teamMembers.length;
  const atCapacity = memberCount >= maxUsers;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
      <div className="px-4 py-3 bg-[#EDE9FF] border-b border-[#DDD6FE] flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold text-[#9A88FD] uppercase tracking-wide">Team</div>
          <div className="text-[15px] font-bold text-[#1A1A2E] mt-0.5">
            {memberCount}/{maxUsers} member{maxUsers !== 1 ? "s" : ""}
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
          teamMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-[#9A88FD]/15 flex items-center justify-center text-sm font-bold text-[#9A88FD] shrink-0 overflow-hidden">
                {m.avatar_url ? (
                  <Image
                    src={m.avatar_url}
                    className="w-10 h-10 rounded-full object-cover"
                    alt=""
                    width={40}
                    height={40}
                  />
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
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900 truncate">{m.full_name || "Unnamed"}</p>
                  {m.isCurrentUser && (
                    <span className="text-[10px] text-[#9A88FD] ml-1.5">(you)</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{m.email || "—"}</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                    <span className="text-[10px] text-gray-400">{m.propertiesCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                      <rect x="9" y="3" width="6" height="4" rx="1" />
                    </svg>
                    <span className="text-[10px] text-gray-400">{m.inspectionsCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="text-[10px] text-gray-400">{m.reportsCount}</span>
                  </div>
                </div>
              </div>
              <span
                className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  m.displayRole === "Owner" ? "bg-[#9A88FD]/10 text-[#9A88FD]" : "bg-gray-100 text-gray-500"
                }`}
              >
                {m.displayRole}
              </span>
              {normalizeProfileRole(m.role) !== "owner" && m.id !== currentUserId && (
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
