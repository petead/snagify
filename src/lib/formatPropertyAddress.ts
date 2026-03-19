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

/**
 * Label for emails, PDF subjects, push: **building + unit first**, not the area/location field.
 * Falls back to location/address only when building name is missing (legacy / incomplete data).
 */
export function formatPropertyBuildingUnit(property: {
  location?: string | null
  address?: string | null
  building_name?: string | null
  unit_number?: string | null
} | null | undefined): string {
  if (!property) return '—'

  const b = property.building_name?.trim()
  const u = property.unit_number?.trim()

  if (b && u) return `${b}, Unit ${u}`
  if (b) return b
  if (u) return `Unit ${u}`

  if (property.location?.trim()) return property.location.trim()
  if (property.address?.trim()) return property.address.trim()

  return '—'
}
