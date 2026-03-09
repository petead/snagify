import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Allow up to 60s for Claude to process the document (PDF can be slow)
export const maxDuration = 60;

const EXTRACT_PROMPT = `Extract from this Dubai tenancy contract.
Return ONLY JSON with these exact keys:

PROPERTY fields (physical, never changes):
- building_name: the building name (e.g. 'Creek Rise Tower 1')
- unit_number: the Property No field (e.g. '3301') — NOT Premises No
- location: the Location/area field
- property_type: normalize to one of: apartment/villa/studio/townhouse
- address: full address combining building + location

INSPECTION/CONTRACT fields (change per contract):
- ejari_ref: the contract number (e.g. '3301-CT1-2026')
- landlord_name
- landlord_email
- landlord_phone
- tenant_name
- tenant_email
- tenant_phone
- contract_from: date in YYYY-MM-DD format
- contract_to: date in YYYY-MM-DD format
- annual_rent: number only, no currency
- security_deposit: number only
- property_size: number only in m²
- inspection_type: always 'check-in' for a new tenancy contract

IMPORTANT:
- unit_number comes from 'Property No' field, NOT 'Premises No (DEWA)'
- building_name comes from 'Building Name' field
- Do not confuse Property No with Plot No or Premises No

Return null for any field not found.
Return only the JSON, no other text.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data: base64Data, mediaType = "application/pdf" } = body as {
      data: string;
      mediaType?: string;
    };

    if (!base64Data || typeof base64Data !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid base64 data" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey,
      timeout: 120000, // 2 minutes for document processing
    });

    const isPdf = mediaType === "application/pdf";

    if (isPdf) {
      let response;
      try {
        response = await anthropic.beta.messages.create({
          betas: ["pdfs-2024-09-25"],
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64Data,
                  },
                },
                { type: "text", text: EXTRACT_PROMPT },
              ],
            },
          ],
        });
      } catch (pdfErr) {
        const message = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        const isAuthOrClose =
          message.includes("401") ||
          message.includes("Premature close") ||
          message.includes("Invalid response body");
        if (isAuthOrClose) {
          return NextResponse.json(
            {
              error:
                "PDF extraction is unavailable (beta or timeout). Please upload a screenshot of your contract as PNG or JPG instead.",
            },
            { status: 503 }
          );
        }
        throw pdfErr;
      }

      const text =
        response.content
          .filter((block): block is { type: "text"; text: string } => block.type === "text")
          .map((block) => block.text)
          .join("") || "";

      const json = parseJsonFromText(text);
      return NextResponse.json(json);
    }

    const imageMediaType =
      mediaType === "image/png"
        ? "image/png"
        : mediaType === "image/jpeg" || mediaType === "image/jpg"
          ? "image/jpeg"
          : "image/png";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: imageMediaType,
                data: base64Data,
              },
            },
            { type: "text", text: EXTRACT_PROMPT },
          ],
        },
      ],
    });

    const text =
      response.content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("") || "";

    const json = parseJsonFromText(text);
    return NextResponse.json(json);
  } catch (err) {
    console.error("extract-contract error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}

function parseJsonFromText(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      // fallback
    }
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return {};
  }
}
