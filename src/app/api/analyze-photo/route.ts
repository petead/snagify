import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const DAMAGE_TAGS_REF = ["scratch", "stain", "crack", "damp", "missing", "broken", "hole", "leak"];

const ANALYZE_PROMPT = `You are inspecting a property in Dubai. Analyze this photo and provide:
1. A brief professional description of what you see (1-2 sentences) in a field "description".
2. The condition: Good, Fair, or Poor.
3. Any damage types from this exact list only: scratch, stain, crack, damp, missing, broken, hole, leak. Return them as "suggested_tags" (array of strings, use the exact words from the list). If no damage, return [].
Return ONLY a JSON object with these exact keys: description (string), condition (string), suggested_tags (array of strings from the list above).
No other text.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image: base64Data, mimeType = "image/jpeg", photoId } = body as {
      image: string;
      mimeType?: string;
      photoId?: string;
    };

    if (!base64Data || typeof base64Data !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid image (base64)" },
        { status: 400 }
      );
    }

    const rawBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const mediaType =
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: rawBase64,
              },
            },
            { type: "text", text: ANALYZE_PROMPT },
          ],
        },
      ],
    });

    const text =
      response.content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const json = jsonMatch
      ? (JSON.parse(jsonMatch[0]) as { description: string; condition: string; suggested_tags?: string[] })
      : { description: "", condition: "Good", suggested_tags: [] as string[] };

    const suggestedTags = Array.isArray(json.suggested_tags)
      ? json.suggested_tags.filter((t) => DAMAGE_TAGS_REF.includes(String(t).toLowerCase()))
      : [];
    const ai_analysis = json.description ?? "";

    if (photoId && typeof photoId === "string") {
      const supabase = await createClient();
      await supabase
        .from("photos")
        .update({ ai_analysis, damage_tags: suggestedTags })
        .eq("id", photoId);
    }

    return NextResponse.json({ ai_analysis, suggested_tags: suggestedTags });
  } catch (err) {
    console.error("analyze-photo error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
