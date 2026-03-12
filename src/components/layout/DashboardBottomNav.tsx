"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, FileText, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/inspections", label: "Inspections", icon: ClipboardList },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/profile", label: "Profile", icon: User },
];

export function DashboardBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around h-16 z-50">
      <div className="max-w-[480px] mx-auto w-full flex items-center justify-around h-full">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 py-2 min-w-[64px] text-xs font-body"
            >
              <Icon
                size={24}
                className={isActive ? "text-purple-600" : "text-gray-400"}
              />
              <span
                className={isActive ? "text-purple-600 font-medium" : "text-gray-500"}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
