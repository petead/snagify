import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const DAMAGE_TAGS_REF = ["scratch", "stain", "crack", "damp", "missing", "broken", "hole", "leak"];

const systemPrompt = `You are an expert property inspector AI for Dubai real estate (RERA/DLD).

Analyze the photo and return a condition summary as SHORT KEYWORDS and FRAGMENTS — not full sentences.
Think like a surveyor's shorthand notes, not a report paragraph.

STYLE RULES:
- Use fragments, not sentences: "wall clean · no cracks" not "The wall appears clean with no visible cracks"
- Separate observations with " · "
- Max 10 words total for condition_summary
- If damage: name it + location only: "scratch on door frame · paint worn"
- If clean: "clean · no visible defects" or "good condition · no damage"
- Never use: "appears", "seems", "it is", "the", "this", "I can see"
- Write in English only
- If photo too blurry/dark: "insufficient quality"

STRICT RULES:
- Only describe what is physically visible
- No people, furniture style, decor, aesthetics
- No assumptions about causes or history
- If damage_found is true, condition_summary MUST mention the damage type and location
- Never say "good condition" or "no damage" when suggesting damage tags

DAMAGE TAGS — only from this list:
scratch / stain / crack / damp / missing / broken / hole / leak

OUTPUT FORMAT (strict JSON only, no extra text):
{
  "condition_summary": "keyword · fragment · keyword",
  "damage_found": true or false,
  "suggested_tags": [] or ["tag1", "tag2"],
  "detected_items": [
    { "name": "item name in English", "condition": "good" | "fair" | "poor" }
  ]
}

DETECTED ITEMS RULES:
- Only list furniture, appliances, and electronics — never structural elements
- Examples of valid items: sofa, TV, refrigerator, washing machine, bed, wardrobe,
  dining table, coffee table, microwave, oven, AC unit, water heater, curtains
- Examples of INVALID items: wall, floor, ceiling, door, window, tile, paint
- Use simple English names, lowercase
- Condition based on visual appearance only
- If no furniture/appliances visible: return empty array []
- Max 10 items per photo

EXAMPLES:

Clean white wall:
{
  "condition_summary": "wall clean · no cracks · no stains",
  "damage_found": false,
  "suggested_tags": []
}

Cracked tile with water stain:
{
  "condition_summary": "floor tile cracked ~10cm · water stain adjacent",
  "damage_found": true,
  "suggested_tags": ["crack", "stain"]
}

Scratched door frame:
{
  "condition_summary": "door frame · scratch mid-height · paint worn",
  "damage_found": true,
  "suggested_tags": ["scratch"]
}

Clean bathroom:
{
  "condition_summary": "fixtures intact · tiles clean · no defects",
  "damage_found": false,
  "suggested_tags": []
}`;

const checkoutComparePrompt = `Property inspector comparing CHECK-IN (first image) vs CHECK-OUT (second image).

Return SHORT KEYWORDS and FRAGMENTS only — no full sentences.
Style: "location · damage type" or "no new damage"
Separator: " · "
Max 12 words total.
Only flag NEW damage not visible at check-in.

EXAMPLES:
- "no new damage detected"
- "left wall · new scratch · ~15cm"
- "ceiling · new damp patch · corner"
- "no change · same condition as entry"
- "window frame · paint chipped · new"

Respond with keywords/fragments only. No sentences.`;

export async function POST(request: Request) {
  // ── Auth guard ──
  const supabaseAuth = await createServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      image,
      base64,
      mimeType = "image/jpeg",
      photoId,
      roomName,
      checkinPhotoUrl: checkinPhotoUrlFromBody,
      isCheckout,
      checkinPhotoId,
      isAdditional,
      prefillDamageTags,
    } = body as {
      image?: string;
      base64?: string;
      mimeType?: string;
      photoId?: string;
      roomName?: string;
      checkinPhotoUrl?: string | null;
      isCheckout?: boolean;
      checkinPhotoId?: string | null;
      isAdditional?: boolean;
      prefillDamageTags?: string[] | null;
    };
    const base64Data = base64 ?? image;

    if (!base64Data || typeof base64Data !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid image (base64)" },
        { status: 400 }
      );
    }

    const imageBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const imageMediaType =
      mimeType === "image/png"
        ? "image/png"
        : mimeType === "image/webp"
          ? "image/webp"
          : "image/jpeg";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey, timeout: 60000 });

    const supabaseAdmin =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          )
        : null;

    let checkinPhotoUrl: string | null = checkinPhotoUrlFromBody ?? null;
    if (checkinPhotoId && supabaseAdmin) {
      const { data: checkinPhoto } = await supabaseAdmin
        .from("photos")
        .select("url")
        .eq("id", checkinPhotoId)
        .single();
      if (checkinPhoto?.url) checkinPhotoUrl = checkinPhoto.url;
    }

    const useCheckoutCompare = Boolean(
      (checkinPhotoId || (isCheckout && checkinPhotoUrl)) &&
        checkinPhotoUrl &&
        typeof checkinPhotoUrl === "string"
    );

    type AllowedMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    const normalizedMediaType = (imageMediaType ?? "image/jpeg") as AllowedMediaType;
    let contentBlocks: Anthropic.MessageParam["content"];

    if (useCheckoutCompare) {
      let checkinBase64: string | null = null;
      try {
        const checkinRes = await fetch(checkinPhotoUrl as string);
        if (checkinRes.ok) {
          const buf = await checkinRes.arrayBuffer();
          checkinBase64 = Buffer.from(buf).toString("base64");
        }
      } catch {
        // Fall back to single-image analysis if fetch fails
      }

      if (checkinBase64) {
        contentBlocks = [
          { type: "text", text: checkoutComparePrompt },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg" as AllowedMediaType,
              data: checkinBase64,
            },
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: normalizedMediaType,
              data: imageBase64,
            },
          },
        ] as Anthropic.MessageParam["content"];
      } else {
        contentBlocks = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: normalizedMediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `This photo was taken in the following room: "${roomName ?? "Unknown room"}". 
Analyze the property condition visible in this photo only.`,
          },
        ] as Anthropic.MessageParam["content"];
      }
    } else if (isAdditional) {
      contentBlocks = [
        {
          type: "text",
          text: `Property inspector — NEW finding at check-out, no entry reference.
Return SHORT KEYWORDS and FRAGMENTS only. No full sentences.
Style: "location · damage type · severity if notable"
Max 10 words. Separator: " · "

EXAMPLES:
- "balcony floor · large stain · dark"
- "bathroom wall · hole · ~3cm · near socket"
- "kitchen cabinet door · broken hinge"`,
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: normalizedMediaType,
            data: imageBase64,
          },
        },
      ] as Anthropic.MessageParam["content"];
    } else {
      contentBlocks = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: normalizedMediaType,
            data: imageBase64,
          },
        },
        {
          type: "text",
          text: `This photo was taken in the following room: "${roomName ?? "Unknown room"}". 
Analyze the property condition visible in this photo only.`,
        },
      ] as Anthropic.MessageParam["content"];
    }

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: contentBlocks,
        },
      ],
    });

    const raw = response.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    let parsed: {
      condition_summary: string;
      damage_found: boolean;
      suggested_tags: string[];
      detected_items?: { name: string; condition: string }[];
    } = { condition_summary: "", damage_found: false, suggested_tags: [] };
    try {
      const jsonStr = raw.replace(/```json|```/g, "").trim();
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]) as typeof parsed;
      } else {
        parsed.condition_summary = raw;
      }
    } catch {
      parsed.condition_summary = raw;
    }

    const suggestedTags = Array.isArray(parsed.suggested_tags)
      ? parsed.suggested_tags
          .map((t) => String(t).toLowerCase())
          .filter((t) => DAMAGE_TAGS_REF.includes(t))
      : [];
    const validatedPrefill = Array.isArray(prefillDamageTags)
      ? prefillDamageTags
          .map((t) => String(t).toLowerCase())
          .filter((t) => DAMAGE_TAGS_REF.includes(t))
      : [];
    /** If AI suggests tags, use them; otherwise keep user / check-in pre-filled tags. */
    const finalDamageTags =
      suggestedTags.length > 0 ? suggestedTags : validatedPrefill;
    const conditionSummary = parsed.condition_summary ?? "";

    if (photoId && typeof photoId === "string") {
      const supabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { error: updateError } = await supabase
        .from("photos")
        .update({
          ai_analysis: conditionSummary,
          notes: conditionSummary,
          damage_tags: finalDamageTags,
        })
        .eq("id", photoId);
      if (updateError) {
        console.error("Failed to update photo:", updateError);
      }
    }

    const detectedItems = Array.isArray(parsed.detected_items) ? parsed.detected_items : []

    return NextResponse.json({
      success: true,
      ai_analysis: conditionSummary,
      damage_tags: finalDamageTags,
      detected_items: detectedItems,
    });
  } catch (err) {
    console.error("analyze-photo error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
