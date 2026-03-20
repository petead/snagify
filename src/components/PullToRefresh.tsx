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
  const show = pullDistance > 12 || isRefreshing;

  const topOffset = Math.max(pullDistance * 0.6 - 4, 0);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          style={{
            position: isRefreshing ? "fixed" : "absolute",
            top: isRefreshing ? 56 : topOffset,
            left: 0,
            right: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <motion.div
            animate={{
              scale: isTriggered || isRefreshing ? 1 : 0.75 + progress * 0.25,
              backgroundColor:
                isTriggered || isRefreshing
                  ? "#9A88FD"
                  : `rgba(154, 136, 253, ${0.15 + progress * 0.2})`,
              boxShadow:
                isTriggered || isRefreshing
                  ? "0 4px 16px rgba(154,136,253,0.4)"
                  : "none",
            }}
            transition={{ duration: 0.15 }}
            className="flex h-10 w-10 items-center justify-center rounded-full"
          >
            {isRefreshing ? (
              <motion.svg
                animate={{ rotate: 360 }}
                transition={{ duration: 0.65, repeat: Infinity, ease: "linear" }}
                width="20"
                height="20"
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
                transition={{ duration: 0.08 }}
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
