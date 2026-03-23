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

    const onStart = (e: TouchEvent | MouseEvent) => {
      if (isInternalLink(e.target)) startBar();
    };

    // touchstart = instantane sur mobile (pas de delai 300ms)
    document.addEventListener("touchstart", onStart, { passive: true });
    // mousedown = instantane sur desktop
    document.addEventListener("mousedown", onStart);

    return () => {
      document.removeEventListener("touchstart", onStart as EventListener);
      document.removeEventListener("mousedown", onStart as EventListener);
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
