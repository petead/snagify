"use client";

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
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const show = pullDistance > 16 || isRefreshing;

  if (!show) return null;

  return (
    <div
      style={{
        position: "absolute",
        // Centre le spinner dans la zone révélée (pullDistance)
        top: isRefreshing ? threshold / 2 - 20 : pullDistance / 2 - 20,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 20,
        transition: isRefreshing ? "top 0.2s ease" : "none",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: isTriggered || isRefreshing ? "#9A88FD" : `rgba(154,136,253,${0.1 + progress * 0.25})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s",
        }}
      >
        {isRefreshing ? (
          <svg
            style={{ animation: "ptr-spin 0.65s linear infinite" }}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg
            style={{ transform: `rotate(${progress * 180}deg)`, transition: "transform 0.1s" }}
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
          </svg>
        )}
      </div>
    </div>
  );
}
