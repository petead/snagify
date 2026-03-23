import { Buffer } from "node:buffer";

export type SignatureRow = {
  signer_type?: string | null;
  signer_name?: string | null;
  signed_at?: string | null;
  signature_data?: string | null;
  otp_verified?: boolean | null;
  refused_at?: string | null;
  refused_reason?: string | null;
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
  /** Data URL (e.g. data:image/png;base64,...) for @react-pdf/renderer Image src */
  data: string | null;
  name?: string | null;
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

/** Use DB value directly when already a data URL; otherwise normalize (e.g. rare https). */
async function embedSignatureData(raw: string | null | undefined): Promise<string | null> {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (s.startsWith("data:")) return s;
  return normalizeSignatureToDataUrl(s);
}

export function isFullySigned(
  embeds: PdfSignatureEmbeds,
  creatorPdfRole: CreatorPdfRole = "inspector"
): boolean {
  const landlordOk = !!embeds.landlord.data;
  const tenantOk = !!embeds.tenant.data;
  if (creatorPdfRole === "inspector") {
    return landlordOk && tenantOk && !!embeds.inspector.data;
  }
  return landlordOk && tenantOk;
}

/**
 * Landlord / tenant from `signatures` rows (signer_type only — no inspector row).
 * Pro inspector slot is filled in generate-pdf from profiles.signature_image_url.
 */
export async function buildPdfSignatureEmbeds(options: {
  rows: SignatureRow[];
  /** Kept for API compatibility; landlord & tenant embeds use signer_type rows only. */
  creatorPdfRole: CreatorPdfRole;
}): Promise<PdfSignatureEmbeds> {
  const { rows } = options;

  const landlordRow = rows.find((r) => r.signer_type === "landlord");
  const rawTenant = rows.find((r) => r.signer_type === "tenant");

  const landlordData = await embedSignatureData(landlordRow?.signature_data ?? null);
  const tenantData = await embedSignatureData(rawTenant?.signature_data ?? null);

  return {
    landlord: {
      data: landlordData,
      name: landlordRow?.signer_name ?? null,
      signedAt: landlordRow?.signed_at ?? null,
    },
    tenant: {
      data: tenantData,
      name: rawTenant?.signer_name ?? null,
      signedAt: rawTenant?.signed_at ?? null,
    },
    inspector: {
      data: null,
      name: null,
      signedAt: null,
    },
  };
}
