/**
 * Returns a clean PDF filename: "{Type}_{Building}_{Unit}.pdf"
 * e.g. "Check-in_Creek_Residences_North_Tower_2_703.pdf"
 */
export function buildPdfFileName(
  inspectionType: string,
  buildingName: string | null | undefined,
  unitNumber: string | null | undefined
): string {
  const type = inspectionType.toLowerCase().includes("check-out")
    ? "Check-out"
    : "Check-in";

  const sanitize = (s: string | null | undefined) =>
    (s ?? "")
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_");

  const building = sanitize(buildingName) || "Property";
  const unit = sanitize(unitNumber) || "Unit";

  return `${type}_${building}_${unit}.pdf`;
}
