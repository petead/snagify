"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function TopLoader() {
  const barRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  const startBar = () => {
    const bar = barRef.current;
    if (!bar) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    bar.style.transition = "none";
    bar.style.width = "0%";
    bar.style.opacity = "1";
    void bar.offsetWidth;
    bar.style.transition = "width 3s cubic-bezier(0.05, 0.8, 0.5, 1)";
    bar.style.width = "92%";
  };

  const completeBar = () => {
    const bar = barRef.current;
    if (!bar) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    bar.style.transition = "width 0.15s ease";
    bar.style.width = "100%";
    timerRef.current = setTimeout(() => {
      bar.style.transition = "opacity 0.2s ease";
      bar.style.opacity = "0";
      setTimeout(() => {
        bar.style.transition = "none";
        bar.style.width = "0%";
      }, 250);
    }, 150);
  };

  // -- Demarre immediatement au touchstart/mousedown --
  useEffect(() => {
    const isInternalLink = (el: EventTarget | null): boolean => {
      const a = (el as HTMLElement)?.closest?.("a");
      if (!a) return false;
      const href = a.getAttribute("href");
      if (!href) return false;
      if (
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto")
      )
        return false;
      if (href === window.location.pathname) return false;
      return true;
    };

    // Track touch start position to distinguish tap from scroll
    let touchStartX = 0;
    let touchStartY = 0;
    let touchTarget: EventTarget | null = null;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchTarget = e.target;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
      // Only trigger if movement < 8px (tap, not scroll)
      if (dx < 8 && dy < 8) {
        const t = touchTarget;
        if (t instanceof Element && t.closest("[data-pull-scroll]")) return;
        if (isInternalLink(t)) startBar();
      }
      touchTarget = null;
    };

    // mousedown stays instant on desktop (no scroll risk)
    const onMouseDown = (e: MouseEvent) => {
      if (isInternalLink(e.target)) startBar();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("mousedown", onMouseDown);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  // -- Complete quand la page est vraiment chargee --
  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;
    completeBar();
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
        boxShadow: "0 0 10px rgba(154,136,253,0.6)",
      }}
    />
  );
}
