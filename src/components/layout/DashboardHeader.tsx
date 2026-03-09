"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function getInitials(fullName: string | null, email: string | null): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    const username = email.split("@")[0];
    return username.slice(0, 2).toUpperCase();
  }
  return "?";
}

function getFirstName(fullName: string | null, email: string | null): string {
  if (fullName?.trim()) {
    const first = fullName.trim().split(/\s+/)[0];
    if (first) return first;
  }
  if (email) return email.split("@")[0];
  return "User";
}

interface DashboardHeaderProps {
  fullName: string | null;
  userEmail: string | null;
}

export function DashboardHeader({ fullName, userEmail }: DashboardHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    setShowMenu(false);
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = getInitials(fullName, userEmail);
  const firstName = getFirstName(fullName, userEmail);

  return (
    <div className="w-full flex items-center justify-between">
      <div className="max-w-[480px] mx-auto w-full flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/logo-icon.png"
            alt=""
            width={32}
            height={32}
            className="flex-shrink-0"
          />
          <span className="font-heading font-bold text-gray-900 text-lg">
            Snagify
          </span>
        </Link>

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 font-heading font-semibold text-sm flex items-center justify-center hover:bg-purple-200 transition-colors"
            aria-expanded={showMenu}
            aria-haspopup="true"
          >
            {initials}
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
                aria-hidden="true"
              />
              <div className="absolute top-16 right-4 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 w-48 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-semibold text-sm text-gray-900">{firstName}</p>
                  <p className="text-xs text-gray-400 truncate">{userEmail ?? ""}</p>
                </div>

                <Link
                  href="/dashboard/profile"
                  onClick={() => setShowMenu(false)}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                >
                  <span>👤</span> My Profile
                </Link>

                <button
                  type="button"
                  onClick={() => setShowMenu(false)}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                >
                  <span>⚙️</span> Settings
                </button>

                <div className="border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-3"
                  >
                    <span>🚪</span> Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
