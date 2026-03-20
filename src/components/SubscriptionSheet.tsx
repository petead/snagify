"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { PricingGrid } from "@/components/PricingGrid";

interface SubscriptionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  creditsBalance: number;
  companyId: string;
}

export function SubscriptionSheet({
  isOpen,
  onClose,
  currentPlan,
  creditsBalance,
  companyId,
}: SubscriptionSheetProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col">
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
            className="relative z-10 bg-[#F8F7F4] flex flex-col w-full h-full"
          >
            <div className="relative shrink-0 px-5 pb-3 pt-4 flex items-center justify-between">
              <div className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-gray-200" />
              <div className="mt-4">
                <h2 className="text-xl font-black text-gray-900">
                  {currentPlan !== "free" ? "Manage subscription" : "Choose your plan"}
                </h2>
                <p className="text-xs text-gray-400">
                  {currentPlan !== "free"
                    ? `Currently on ${currentPlan} · ${creditsBalance} credits remaining`
                    : "Unlock the full power of Snagify"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              <PricingGrid
                currentPlan={currentPlan}
                creditsBalance={creditsBalance}
                companyId={companyId}
                onSuccess={onClose}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
