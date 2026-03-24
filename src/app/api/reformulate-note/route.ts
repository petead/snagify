import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const maxDuration = 30;

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
    const { text } = body as { text: string };

    if (typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid text" },
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

    const anthropic = new Anthropic({ apiKey, timeout: 60000 });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a professional property inspector in Dubai.
Reformulate this voice note into professional inspection language.
Keep it concise and factual. Return only the reformulated text, nothing else.

Input:
${text}`,
        },
      ],
    });

    const reformulated =
      response.content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim() || text;

    return NextResponse.json({ text: reformulated });
  } catch (err) {
    console.error("reformulate-note error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reformulation failed" },
      { status: 500 }
    );
  }
}
