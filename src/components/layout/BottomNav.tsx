"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Building2, Plus, FileText, User } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Building2, label: "Properties", path: "/properties" },
    { icon: Plus, label: null, path: "/inspection/new" }, // center button
    { icon: FileText, label: "Reports", path: "/reports" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 w-full bg-white border-t border-gray-100"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab, index) => {
          const isCenter = index === 2;
          const isActive =
            pathname === tab.path ||
            (tab.path !== "/dashboard" && pathname.startsWith(tab.path));

          if (isCenter) {
            return (
              <button
                key="new"
                type="button"
                onClick={() => router.push("/inspection/new")}
                className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg -mt-5 transition-transform active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #9A88FD, #7B65FC)",
                }}
              >
                <Plus size={26} color="white" strokeWidth={2.5} />
              </button>
            );
          }

          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => router.push(tab.path)}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all active:scale-95"
            >
              <tab.icon
                size={22}
                color={isActive ? "#9A88FD" : "#9CA3AF"}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span
                className="text-xs font-medium"
                style={{ color: isActive ? "#9A88FD" : "#9CA3AF" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
