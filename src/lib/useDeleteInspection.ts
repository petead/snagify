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

export function useDeleteInspection() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const deleteInspection = async (
    inspectionId: string,
    redirectTo?: string
  ): Promise<DeleteResult> => {
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
        return { canDelete: false, reason: "SIGNED", signerType: "", signedCount: 0 };
      }

      if (redirectTo) router.push(redirectTo);
      else router.refresh();

      return { canDelete: true };
    } finally {
      setLoading(false);
    }
  };

  return { deleteInspection, loading };
}
