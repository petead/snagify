"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function getInitials(fullName: string | null): string {
  if (!fullName?.trim()) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

interface DashboardHeaderProps {
  fullName: string | null;
}

export function DashboardHeader({ fullName }: DashboardHeaderProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    setOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = getInitials(fullName);

  return (
    <header className="sticky top-0 z-50 h-16 bg-white border-b border-[#E5E7EB]">
      <div className="h-full max-w-[480px] mx-auto px-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/logo-icon.png"
            alt=""
            width={32}
            height={32}
            className="flex-shrink-0"
          />
          <span className="font-heading font-bold text-brand-dark text-lg">
            Snagify
          </span>
        </Link>

        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-10 h-10 rounded-full bg-brand-purple/10 text-brand-purple font-heading font-semibold text-sm flex items-center justify-center hover:bg-brand-purple/20 transition-colors"
            aria-expanded={open}
            aria-haspopup="true"
          >
            {initials}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-48 py-1 bg-white rounded-xl shadow-lg border border-gray-100 z-50">
              <Link
                href="/dashboard/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-body text-brand-dark hover:bg-gray-50"
              >
                <User size={18} />
                Profile
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-body text-brand-dark hover:bg-gray-50 text-left"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
