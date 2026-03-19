import { Buffer } from "node:buffer";

export type SignatureRow = {
  signer_type?: string | null;
  signed_at?: string | null;
  signature_data?: string | null;
  otp_verified?: boolean | null;
};

export type PdfPartySignature = {
  base64: string | null;
  signedAt?: string | null;
};

export type PdfSignatureEmbeds = {
  landlord: PdfPartySignature;
  tenant: PdfPartySignature;
  inspector: PdfPartySignature;
};

/** Fetch remote image and return a data URL suitable for @react-pdf/renderer. */
export async function fetchUrlAsBase64DataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

/** Normalize stored signature (data URL or https URL) to a data URL. */
export async function normalizeSignatureToDataUrl(
  raw: string | null | undefined
): Promise<string | null> {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) {
    return fetchUrlAsBase64DataUrl(s);
  }
  return null;
}

export function isFullySigned(embeds: PdfSignatureEmbeds): boolean {
  return !!(
    embeds.landlord.base64 &&
    embeds.tenant.base64 &&
    embeds.inspector.base64
  );
}

/**
 * Build landlord / tenant / inspector image data URLs for PDF embedding.
 * Mirrors generatePDF.tsx inspector fallbacks (individual vs pro).
 */
export async function buildPdfSignatureEmbeds(options: {
  rows: SignatureRow[];
  profileSignatureUrl?: string | null;
  accountType: string;
  inspectionCreatedAt?: string | null;
}): Promise<PdfSignatureEmbeds> {
  const { rows, profileSignatureUrl, accountType, inspectionCreatedAt } = options;
  const isIndividual = (accountType || "individual") === "individual";

  const landlordRow = rows.find((r) => r.signer_type === "landlord");
  const tenantRow = rows.find((r) => r.signer_type === "tenant");
  const inspectorRow = rows.find(
    (r) => r.signer_type === "agent" || r.signer_type === "inspector"
  );

  const landlordBase64 = await normalizeSignatureToDataUrl(
    landlordRow?.signature_data ?? null
  );
  const tenantBase64 = await normalizeSignatureToDataUrl(
    tenantRow?.signature_data ?? null
  );

  let inspectorBase64 = await normalizeSignatureToDataUrl(
    inspectorRow?.signature_data ?? null
  );
  let inspectorSignedAt: string | null = inspectorRow?.signed_at ?? null;

  if (!inspectorBase64 && isIndividual) {
    inspectorBase64 = landlordBase64;
    inspectorSignedAt = landlordRow?.signed_at ?? null;
  }

  if (!inspectorBase64 && !isIndividual && profileSignatureUrl) {
    inspectorBase64 = await normalizeSignatureToDataUrl(profileSignatureUrl);
    inspectorSignedAt = inspectionCreatedAt ?? null;
  }

  return {
    landlord: {
      base64: landlordBase64,
      signedAt: landlordRow?.signed_at ?? null,
    },
    tenant: {
      base64: tenantBase64,
      signedAt: tenantRow?.signed_at ?? null,
    },
    inspector: {
      base64: inspectorBase64,
      signedAt: inspectorSignedAt,
    },
  };
}
