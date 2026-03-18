/**
 * Build a clean display address from property fields.
 * The DB `address` field may already contain building_name and unit_number.
 * Strategy: if building_name exists, use it + unit_number only.
 * Otherwise fall back to address field as-is.
 */
export function formatPropertyAddress(property: {
  address?: string | null
  building_name?: string | null
  unit_number?: string | null
} | null | undefined): string {
  if (!property) return '—'

  if (property.building_name) {
    const parts: string[] = [property.building_name]
    if (property.unit_number) parts.push(`Unit ${property.unit_number}`)
    return parts.join(', ')
  }

  return property.address || '—'
}
