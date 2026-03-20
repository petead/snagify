"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { ProAccessState } from "@/lib/checkProAccess";

interface ProGateSheetProps {
  state: ProAccessState;
  balance: number;
  plan: string;
  cost: number;
  actionLabel: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ProGateSheet({
  state,
  balance,
  plan,
  cost,
  actionLabel,
  onConfirm,
  onClose,
}: ProGateSheetProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const closeAndGo = (url: string) => {
    onClose();
    router.push(url);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-[430px] rounded-t-3xl bg-[#12102A] px-5 pb-6 pt-5 text-white"
        >
        {state === "no_subscription" && (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold">Activate your plan</h3>
            <p className="mb-5 text-sm text-white/70">
              You need an active Pro subscription to inspect properties.
              Choose the plan that fits your workflow.
            </p>
            <button
              type="button"
              onClick={() => closeAndGo("/profile?tab=subscription")}
              className="mb-2 w-full rounded-2xl bg-[#9A88FD] py-3 font-bold"
            >
              See plans →
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-white/10 py-3 font-semibold text-white/90"
            >
              Maybe later
            </button>
          </>
        )}

        {state === "no_credits" && (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold">{"You're out of credits"}</h3>
            <p className="mb-5 text-sm text-white/70">
              Your {plan} plan has {balance} credit{balance !== 1 ? "s" : ""} remaining.
              Top up to continue inspecting.
            </p>
            <button
              type="button"
              onClick={() => closeAndGo("/profile?tab=subscription")}
              className="mb-2 w-full rounded-2xl bg-[#9A88FD] py-3 font-bold"
            >
              Buy credits →
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-white/10 py-3 font-semibold text-white/90"
            >
              Maybe later
            </button>
          </>
        )}

        {state === "ok" && (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" />
                <polyline points="8 12 11 15 16 9" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold">{actionLabel}</h3>
            <p className="mb-4 text-sm text-white/70">
              This will use {cost} credit{cost !== 1 ? "s" : ""} from your balance.
            </p>
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
              <div className="flex justify-between py-1"><span className="text-white/70">Current balance</span><span>{balance} cr</span></div>
              <div className="flex justify-between py-1"><span className="text-white/70">Cost</span><span>-{cost} cr</span></div>
              <div className="my-1 h-px bg-white/10" />
              <div className="flex justify-between py-1 font-bold"><span>After</span><span className="text-[#FEDE80]">{Math.max(0, balance - cost)} cr</span></div>
            </div>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={submitting}
              className="mb-2 w-full rounded-2xl bg-[#9A88FD] py-3 font-bold disabled:opacity-60"
            >
              Confirm & continue →
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-white/10 py-3 font-semibold text-white/90"
            >
              Cancel
            </button>
          </>
        )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}

