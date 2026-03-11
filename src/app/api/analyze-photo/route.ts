import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image, base64, mimeType = "image/jpeg", photoId, roomName } = body as {
      image?: string;
      base64?: string;
      mimeType?: string;
      photoId?: string;
      roomName?: string;
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

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: imageMediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `This photo was taken in the following room: "${roomName ?? "Unknown room"}". 
Analyze the property condition visible in this photo only.`,
            },
          ],
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
      const supabase = await createClient();
      await supabase
        .from("photos")
        .update({
          ai_analysis: conditionSummary,
          notes: conditionSummary,
          damage_tags: suggestedTags,
        })
        .eq("id", photoId);
    }

    return NextResponse.json({
      success: true,
      ai_analysis: conditionSummary,
      damage_tags: suggestedTags,
      damage_found: parsed.damage_found,
    });
  } catch (err) {
    console.error("analyze-photo error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
