import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

/** Normalize a string the same way as the DB normalized_key column */
function normalize(s: string): string {
  return (s ?? "").toLowerCase().trim().replace(/\s+/g, "");
}

/** Simple similarity score between 2 strings (0 = no match, 1 = identical) */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  // Check if one contains the other
  if (longer.includes(shorter)) return shorter.length / longer.length;
  // Count common characters
  let matches = 0;
  for (const char of shorter) {
    if (longer.includes(char)) matches++;
  }
  return matches / longer.length;
}

type PropertyRow = {
  id: string;
  building_name: string | null;
  unit_number: string | null;
  normalized_key: string | null;
  location: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { building_name, unit_number } = (await req.json()) as {
      building_name?: string;
      unit_number?: string;
    };

    if (!building_name || !unit_number) {
      return NextResponse.json({ duplicates: [] });
    }

    // Fetch all properties for this agent
    const { data: properties } = await supabase
      .from("properties")
      .select("id, building_name, unit_number, normalized_key, location")
      .eq("agent_id", user.id);

    if (!properties || properties.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }

    // Find similar properties using fuzzy match on building name
    // Unit number must match exactly (normalized)
    const inputUnitNorm = normalize(unit_number);
    const inputBuildingNorm = normalize(building_name);

    const similar = (properties as PropertyRow[]).filter((p) => {
      const pUnitNorm = normalize(p.unit_number ?? "");
      const pBuildingNorm = normalize(p.building_name ?? "");

      // Unit must be identical (normalized)
      if (pUnitNorm !== inputUnitNorm) return false;

      // Building name similarity must be > 0.5
      const score = similarity(inputBuildingNorm, pBuildingNorm);
      return score > 0.5;
    });

    return NextResponse.json({ duplicates: similar });
  } catch (err: unknown) {
    console.error("[check-duplicate]", err);
    const message = err instanceof Error ? err.message : "Failed to check duplicates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

