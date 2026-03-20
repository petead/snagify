"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  /** px to pull before triggering */
  threshold?: number;
  /** pull resistance factor */
  resistance?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 72,
  resistance = 0.4,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);

  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setScrollEl(node);
  }, []);

  useEffect(() => {
    const el = scrollEl;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshingRef.current) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff <= 0) {
        setPullDistance(0);
        setIsTriggered(false);
        pullDistanceRef.current = 0;
        return;
      }

      const distance = Math.min(diff * resistance, threshold * 1.5);
      setPullDistance(distance);
      pullDistanceRef.current = distance;
      setIsTriggered(distance >= threshold);
      e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      const dist = pullDistanceRef.current;
      if (dist >= threshold) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        try {
          await onRefreshRef.current();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
          setIsTriggered(false);
          pullDistanceRef.current = 0;
        }
      } else {
        setPullDistance(0);
        setIsTriggered(false);
        pullDistanceRef.current = 0;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [scrollEl, threshold, resistance]);

  return {
    pullDistance,
    isRefreshing,
    isTriggered,
    containerRef,
  };
}
