import { Buffer } from "node:buffer";

export type SignatureRow = {
  signer_type?: string | null;
  signed_at?: string | null;
  signature_data?: string | null;
  otp_verified?: boolean | null;
};

/** Which PDF signature column the logged-in agent (inspection creator) maps to */
export type CreatorPdfRole = "landlord" | "tenant" | "inspector";

export function resolveCreatorPdfRole(
  accountType?: string | null,
  individualRole?: string | null
): CreatorPdfRole {
  if (accountType === "pro") return "inspector";
  if (individualRole === "tenant") return "tenant";
  return "landlord";
}

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

export function isFullySigned(
  embeds: PdfSignatureEmbeds,
  creatorPdfRole: CreatorPdfRole = "inspector"
): boolean {
  const landlordOk = !!embeds.landlord.base64;
  const tenantOk = !!embeds.tenant.base64;
  if (creatorPdfRole === "inspector") {
    return landlordOk && tenantOk && !!embeds.inspector.base64;
  }
  return landlordOk && tenantOk;
}

/**
 * Build landlord / tenant / inspector image data URLs for PDF embedding.
 * Assigns the creator's pad signature to the correct column (owner → landlord, tenant → tenant, pro → inspector).
 */
export async function buildPdfSignatureEmbeds(options: {
  rows: SignatureRow[];
  profileSignatureUrl?: string | null;
  inspectionCreatedAt?: string | null;
  creatorPdfRole: CreatorPdfRole;
}): Promise<PdfSignatureEmbeds> {
  const {
    rows,
    profileSignatureUrl,
    inspectionCreatedAt,
    creatorPdfRole,
  } = options;

  const rawLandlord = rows.find((r) => r.signer_type === "landlord");
  const rawTenant = rows.find((r) => r.signer_type === "tenant");
  const rawAgentInspector = rows.find(
    (r) => r.signer_type === "agent" || r.signer_type === "inspector"
  );

  const creatorSig =
    rawAgentInspector ??
    (creatorPdfRole === "landlord"
      ? rawLandlord
      : creatorPdfRole === "tenant"
        ? rawTenant
        : null) ??
    null;

  const landlordRow =
    creatorPdfRole === "landlord" ? creatorSig ?? rawLandlord : rawLandlord;
  const tenantRow =
    creatorPdfRole === "tenant" ? creatorSig ?? rawTenant : rawTenant;
  const inspectorRow: SignatureRow | null =
    creatorPdfRole === "inspector"
      ? creatorSig ?? rawAgentInspector ?? null
      : null;

  const landlordBase64 = await normalizeSignatureToDataUrl(
    landlordRow?.signature_data ?? null
  );
  const tenantBase64 = await normalizeSignatureToDataUrl(
    tenantRow?.signature_data ?? null
  );
  const landlordSignedAt: string | null = landlordRow?.signed_at ?? null;
  const tenantSignedAt: string | null = tenantRow?.signed_at ?? null;

  let inspectorBase64: string | null = await normalizeSignatureToDataUrl(
    inspectorRow?.signature_data ?? null
  );
  let inspectorSignedAt: string | null = inspectorRow?.signed_at ?? null;

  if (
    creatorPdfRole === "inspector" &&
    !inspectorBase64 &&
    profileSignatureUrl
  ) {
    inspectorBase64 = await normalizeSignatureToDataUrl(profileSignatureUrl);
    inspectorSignedAt = inspectionCreatedAt ?? null;
  }

  return {
    landlord: {
      base64: landlordBase64,
      signedAt: landlordSignedAt,
    },
    tenant: {
      base64: tenantBase64,
      signedAt: tenantSignedAt,
    },
    inspector: {
      base64: creatorPdfRole === "inspector" ? inspectorBase64 : null,
      signedAt: creatorPdfRole === "inspector" ? inspectorSignedAt : null,
    },
  };
}
