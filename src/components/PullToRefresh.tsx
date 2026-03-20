"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  isTriggered: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  isTriggered,
  threshold = 72,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const show = pullDistance > 8 || isRefreshing;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex justify-center"
          style={{ paddingTop: Math.max(pullDistance - 8, 0) }}
        >
          <motion.div
            animate={{
              scale: isTriggered || isRefreshing ? 1 : 0.8 + progress * 0.2,
              backgroundColor:
                isTriggered || isRefreshing
                  ? "#9A88FD"
                  : `rgba(154, 136, 253, ${0.1 + progress * 0.15})`,
            }}
            transition={{ duration: 0.15 }}
            className="flex h-9 w-9 items-center justify-center rounded-full shadow-sm"
          >
            {isRefreshing ? (
              <motion.svg
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </motion.svg>
            ) : (
              <motion.svg
                animate={{ rotate: progress * 180 }}
                transition={{ duration: 0.1 }}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isTriggered ? "white" : "#9A88FD"}
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </motion.svg>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
