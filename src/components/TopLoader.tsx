"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function TopLoader() {
  const barRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  // Demarre au changement de pathname (fonctionne pour Link ET router.push)
  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    const bar = barRef.current;
    if (!bar) return;

    // Reset
    bar.style.transition = "none";
    bar.style.width = "0%";
    bar.style.opacity = "1";
    void bar.offsetWidth;

    // Avance rapidement a 90%
    bar.style.transition = "width 0.3s ease";
    bar.style.width = "90%";

    // Complete apres 300ms
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      bar.style.transition = "width 0.1s ease";
      bar.style.width = "100%";
      setTimeout(() => {
        bar.style.transition = "opacity 0.25s ease";
        bar.style.opacity = "0";
        setTimeout(() => {
          bar.style.transition = "none";
          bar.style.width = "0%";
        }, 300);
      }, 100);
    }, 300);
  }, [pathname]);

  // Demarre au clic sur <a> pour reactivite immediate
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto")
      )
        return;
      if (href === window.location.pathname) return;

      const bar = barRef.current;
      if (!bar) return;
      bar.style.transition = "none";
      bar.style.width = "0%";
      bar.style.opacity = "1";
      void bar.offsetWidth;
      bar.style.transition = "width 2s cubic-bezier(0.1,0.05,0,1)";
      bar.style.width = "85%";
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

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
