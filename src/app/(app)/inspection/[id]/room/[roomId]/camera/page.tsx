"use client";

/**
 * Deep link placeholder: photo capture & compression live in InspectionClient
 * (`handlePhotoCapture` + `@/lib/compressPhoto`). This route keeps URL parity for
 * bookmarks; the main flow is `/inspection/[id]` with in-page GhostCamera.
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InspectionRoomCameraPage() {
  const params = useParams();
  const router = useRouter();
  const inspectionId = typeof params?.id === "string" ? params.id : "";

  useEffect(() => {
    if (inspectionId) {
      router.replace(`/inspection/${inspectionId}`);
    }
  }, [inspectionId, router]);

  return null;
}
