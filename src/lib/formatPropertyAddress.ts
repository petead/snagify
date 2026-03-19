/**
 * Build a clean display location from property fields.
 * Concatenations are for display only — `properties.location` should be the AI-extracted value.
 */
export function formatPropertyAddress(property: {
  location?: string | null
  // legacy
  address?: string | null
  building_name?: string | null
  unit_number?: string | null
} | null | undefined): string {
  if (!property) return '—'

  if (property.location) return property.location
  if (property.address) return property.address

  if (property.building_name) {
    const parts: string[] = [property.building_name]
    if (property.unit_number) parts.push(`Unit ${property.unit_number}`)
    return parts.join(', ')
  }

  return '—'
}
