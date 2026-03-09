import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const ANALYZE_PROMPT = `You are inspecting a property in Dubai. Analyze this photo and provide:
1. A brief professional description of what you see (1-2 sentences)
2. The condition: Good, Fair, or Poor
3. Any issues or damage you notice
Return ONLY a JSON object with these exact keys: description (string), condition (string), issues (array of strings).
No other text.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image: base64Data, mimeType = "image/jpeg" } = body as {
      image: string;
      mimeType?: string;
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
      ? (JSON.parse(jsonMatch[0]) as { description: string; condition: string; issues: string[] })
      : { description: "", condition: "Good", issues: [] as string[] };

    return NextResponse.json(json);
  } catch (err) {
    console.error("analyze-photo error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
