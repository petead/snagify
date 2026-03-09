"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fcfcfc" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontWeight: 700, fontSize: 18, color: "#1A1A1A", marginBottom: 8 }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              backgroundColor: "#9A88FD",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
