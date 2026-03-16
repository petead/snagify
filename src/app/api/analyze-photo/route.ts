import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const maxDuration = 30;

const DAMAGE_TAGS_REF = ["scratch", "stain", "crack", "damp", "missing", "broken", "hole", "leak"];

const systemPrompt = `You are an expert property inspector AI assistant specialized 
in real estate condition reports for the Dubai rental market (RERA/DLD standards).

Your ONLY job is to analyze photos of property rooms and surfaces to:
1. Describe the visible condition of the room or element shown
2. Identify any damage, wear, or defects visible in the photo
3. Suggest relevant damage tags from the allowed list

STRICT RULES:
- Respond ONLY about what is physically visible in the photo
- Do NOT mention people, personal belongings, furniture style, decor taste, or aesthetics
- Do NOT make assumptions about causes or history of damage
- Do NOT use subjective language like "beautiful", "lovely", "unfortunate"
- Do NOT describe anything outside the scope of property condition
- Keep descriptions factual, concise, and professional (max 2 sentences)
- Write in English only
- If the photo is too blurry or dark to assess, say: "Photo quality insufficient for assessment."

IMPORTANT — Consistency between description and tags:
If damage_found is true or you suggest any damage tags, your condition_summary MUST acknowledge them.
Never say "good condition", "no visible defects", "no damage", "appears clean", or "no issues" when you are suggesting damage tags.
If you suggest tags, reference them specifically in the summary:
- crack → mention the crack, its approximate location and severity
- broken → describe what appears broken
- hole → note the hole location
- scratch → mention visible scratches
- stain → describe the staining
- damp / leak / missing → describe accordingly
If no damage tags are suggested, you may describe the area as being in acceptable or good condition.

DAMAGE TAGS — only suggest tags from this exact list:
scratch / stain / crack / damp / missing / broken / hole / leak

OUTPUT FORMAT (strict JSON, no extra text):
{
  "condition_summary": "Brief factual description of what is visible and its condition.",
  "damage_found": true or false,
  "suggested_tags": [] or ["tag1", "tag2"]
}

EXAMPLES:

Photo of a clean white wall:
{
  "condition_summary": "Wall surface is clean and in good condition with no visible defects.",
  "damage_found": false,
  "suggested_tags": []
}

Photo of a cracked tile with water stain:
{
  "condition_summary": "Floor tile shows a visible crack running approximately 10cm, with adjacent water staining.",
  "damage_found": true,
  "suggested_tags": ["crack", "stain"]
}`;

const checkoutComparePrompt = `You are a professional property inspector in Dubai. Compare these two photos of the same room: the FIRST image is from the CHECK-IN inspection (entry condition), the SECOND is from the CHECK-OUT inspection (exit condition). Identify any NEW damage, deterioration, or changes that were NOT present at check-in. Be specific about location and nature of damage. If no new damage is visible, state 'No new damage detected vs check-in.' Keep response under 60 words.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      image,
      base64,
      mimeType = "image/jpeg",
      photoId,
      roomName,
      checkinPhotoUrl,
      isCheckout,
    } = body as {
      image?: string;
      base64?: string;
      mimeType?: string;
      photoId?: string;
      roomName?: string;
      checkinPhotoUrl?: string | null;
      isCheckout?: boolean;
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

    const useCheckoutCompare =
      Boolean(isCheckout && checkinPhotoUrl && typeof checkinPhotoUrl === "string");

    type AllowedMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    const normalizedMediaType = (imageMediaType ?? "image/jpeg") as AllowedMediaType;
    let contentBlocks: Anthropic.MessageParam["content"];

    if (useCheckoutCompare) {
      // Fetch check-in image and convert to base64 for comparison
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
      ? parsed.suggested_tags.filter((t) =>
          DAMAGE_TAGS_REF.includes(String(t).toLowerCase())
        )
      : [];
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
          damage_tags: suggestedTags,
        })
        .eq("id", photoId);
      if (updateError) {
        console.error("Failed to update photo:", updateError);
      }
      console.log(
        "AI update result for photoId:",
        photoId,
        "notes:",
        conditionSummary?.substring(0, 50)
      );
    }

    return NextResponse.json({
      success: true,
      ai_analysis: conditionSummary,
      damage_tags: suggestedTags,
    });
  } catch (err) {
    console.error("analyze-photo error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
