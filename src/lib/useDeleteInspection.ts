"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteResult =
  | { canDelete: true }
  | {
      canDelete: false;
      reason: "SIGNED";
      signerType: string;
      signedCount: number;
    }
  | { canDelete: false; reason: "HAS_CHECKOUT" };

export type DeleteInspectionOptions = {
  onOptimistic?: () => void;
  onRollback?: () => void;
  onSuccess?: () => void;
};

export function useDeleteInspection() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const deleteInspection = async (
    inspectionId: string,
    redirectTo?: string,
    options?: DeleteInspectionOptions
  ): Promise<DeleteResult> => {
    const { onOptimistic, onRollback, onSuccess } = options ?? {};
    onOptimistic?.();

    setLoading(true);
    try {
      const res = await fetch("/api/delete-inspection", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "SIGNED") {
          return {
            canDelete: false,
            reason: "SIGNED",
            signerType: data.signerType ?? "",
            signedCount: data.signedCount ?? 0,
          };
        }
        if (data.error === "HAS_CHECKOUT") {
          return { canDelete: false, reason: "HAS_CHECKOUT" };
        }
        onRollback?.();
        console.error("Delete inspection failed:", data.error);
        alert("Failed to delete. Please try again.");
        return { canDelete: false, reason: "SIGNED", signerType: "", signedCount: 0 };
      }

      router.refresh();
      onSuccess?.();
      if (redirectTo) router.push(redirectTo);

      return { canDelete: true };
    } catch (err) {
      onRollback?.();
      console.error("Delete inspection error:", err);
      alert("Failed to delete. Please try again.");
      return { canDelete: false, reason: "SIGNED", signerType: "", signedCount: 0 };
    } finally {
      setLoading(false);
    }
  };

  return { deleteInspection, loading };
}
