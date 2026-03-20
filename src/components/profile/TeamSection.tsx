"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Loader2, UserPlus, X, Mail, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { normalizeProfileRole } from "@/lib/profileLabels";

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
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

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

  const currentUserMember = teamMembers.find((m) => m.id === currentUserId);
  const isCurrentUserOwner =
    !!currentUserMember && normalizeProfileRole(currentUserMember.role) === "owner";

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
              {isCurrentUserOwner &&
                !m.isCurrentUser &&
                normalizeProfileRole(m.role) !== "owner" && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setDeletingMember(m)}
                    className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0 ml-2 hover:bg-red-100 transition-colors"
                    aria-label="Remove inspector"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </motion.button>
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

      {portalMounted &&
        deletingMember &&
        createPortal(
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center px-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => !deleteLoading && setDeletingMember(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-5 mx-auto">
                  <svg
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </div>

                <h3 className="text-lg font-black text-gray-900 text-center mb-2">
                  Remove {deletingMember.full_name || "this inspector"}?
                </h3>

                <p className="text-sm text-gray-500 text-center leading-relaxed mb-1">
                  This will permanently delete all data associated with this inspector:
                </p>

                <div className="bg-red-50 rounded-2xl p-4 mb-6 mt-3">
                  <div className="flex flex-col gap-2">
                    {[
                      `${deletingMember.propertiesCount} propert${deletingMember.propertiesCount !== 1 ? "ies" : "y"}`,
                      `${deletingMember.inspectionsCount} inspection${deletingMember.inspectionsCount !== 1 ? "s" : ""}`,
                      `${deletingMember.reportsCount} report${deletingMember.reportsCount !== 1 ? "s" : ""}`,
                      "All photos & signatures",
                      "Account access",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#EF4444"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span className="text-xs text-red-700 font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-red-500 mt-3 font-semibold text-center">
                    This action cannot be undone.
                  </p>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={deleteLoading}
                  onClick={async () => {
                    setDeleteLoading(true);
                    try {
                      const res = await fetch("/api/team/remove-inspector", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          inspectorId: deletingMember.id,
                          companyId: company.id,
                        }),
                      });
                      const result = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(result.error || "Failed to remove inspector");

                      setToast({
                        type: "success",
                        message: `${deletingMember.full_name || "Inspector"} removed from team`,
                      });
                      setDeletingMember(null);
                      await fetchTeamMembers();
                    } catch (err: unknown) {
                      setToast({
                        type: "error",
                        message: err instanceof Error ? err.message : "Failed to remove inspector",
                      });
                    } finally {
                      setDeleteLoading(false);
                    }
                  }}
                  className="w-full bg-red-500 text-white font-bold py-3.5 rounded-2xl text-sm mb-3 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleteLoading ? (
                    <svg
                      className="animate-spin"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : null}
                  {deleteLoading ? "Removing..." : "Yes, remove inspector"}
                </motion.button>

                <button
                  type="button"
                  onClick={() => !deleteLoading && setDeletingMember(null)}
                  className="w-full text-gray-400 text-sm py-2"
                >
                  Cancel
                </button>
            </motion.div>
          </motion.div>,
          document.body
        )}

      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 z-[10000] max-w-[min(90vw,360px)] -translate-x-1/2 rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-lg ${
            toast.type === "success" ? "bg-gray-900 text-white" : "bg-red-600 text-white"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
