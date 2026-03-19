"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center justify-center px-6 max-w-[480px] mx-auto">
      <div className="text-center">
        <p className="font-heading font-bold text-lg text-[#1A1A1A] mb-2">
          Could not load dashboard
        </p>
        <p className="font-body text-sm text-gray-500 mb-6">
          {error.message || "Please try again."}
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-2xl px-4 py-3 font-heading font-bold text-white active:scale-95 transition-transform"
            style={{ backgroundColor: "#9A88FD" }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="w-full rounded-xl px-4 py-3 font-body text-sm text-[#9A88FD] font-medium inline-block"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
