"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="font-heading font-bold text-lg text-[#1A1A1A] mb-2">
          Something went wrong
        </p>
        <p className="font-body text-sm text-gray-500 mb-6">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl px-4 py-3 font-heading font-bold text-white"
            style={{ backgroundColor: "#9A88FD" }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="w-full rounded-xl px-4 py-3 font-body text-sm text-[#9A88FD] font-medium"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
