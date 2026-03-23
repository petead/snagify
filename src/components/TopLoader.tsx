"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function TopLoader() {
  const barRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const startedRef = useRef(false);

  // -- START: on any internal link click --
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;
      // Only internal links, not anchors, not external
      if (
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto")
      )
        return;
      // Don't fire if same page
      if (href === window.location.pathname) return;

      startBar();
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // -- COMPLETE: when pathname actually changes --
  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;
    completeBar();
  }, [pathname]);

  function startBar() {
    const bar = barRef.current;
    if (!bar || startedRef.current) return;
    startedRef.current = true;

    if (timerRef.current) clearTimeout(timerRef.current);

    bar.style.transition = "none";
    bar.style.width = "0%";
    bar.style.opacity = "1";

    void bar.offsetWidth; // force reflow

    bar.style.transition = "width 0.8s cubic-bezier(0.1, 0.05, 0, 1)";
    bar.style.width = "85%";
  }

  function completeBar() {
    const bar = barRef.current;
    if (!bar) return;
    startedRef.current = false;

    if (timerRef.current) clearTimeout(timerRef.current);

    bar.style.transition = "width 0.15s ease";
    bar.style.width = "100%";

    timerRef.current = setTimeout(() => {
      if (!bar) return;
      bar.style.transition = "opacity 0.2s ease";
      bar.style.opacity = "0";
      setTimeout(() => {
        bar.style.transition = "none";
        bar.style.width = "0%";
      }, 250);
    }, 150);
  }

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
        boxShadow: "0 0 8px rgba(154,136,253,0.5)",
      }}
    />
  );
}
