"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function TopLoader() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    const bar = barRef.current;
    if (!bar) return;

    // Start
    bar.style.transition = "none";
    bar.style.width = "0%";
    bar.style.opacity = "1";

    // Force reflow
    void bar.offsetWidth;

    bar.style.transition = "width 0.4s ease";
    bar.style.width = "80%";

    // Complete
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      bar.style.transition = "width 0.2s ease, opacity 0.3s ease 0.2s";
      bar.style.width = "100%";
      setTimeout(() => {
        bar.style.opacity = "0";
        setTimeout(() => {
          bar.style.width = "0%";
        }, 400);
      }, 200);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]);

  return (
    <div
      ref={barRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 3,
        width: "0%",
        background: "#9A88FD",
        zIndex: 99999,
        opacity: 0,
        pointerEvents: "none",
        borderRadius: "0 2px 2px 0",
        boxShadow: "0 0 8px rgba(154,136,253,0.6)",
      }}
    />
  );
}
