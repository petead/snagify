"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Run an async mutation with optimistic UI: on failure, restore previous state and optionally refresh.
 */
export async function optimisticAction<T>(
  rollbackState: T,
  setState: (val: T) => void,
  action: () => Promise<void>,
  router: AppRouterInstance,
  onError?: (err: unknown) => void
): Promise<void> {
  try {
    await action();
    router.refresh();
  } catch (err) {
    setState(rollbackState);
    console.error("Action failed:", err);
    onError ? onError(err) : alert("Something went wrong. Please try again.");
  }
}
