const MAX_ACTIONS = 10

export interface BreadcrumbEntry {
  action: string
  page: string
  timestamp: string
}

let _crumbs: BreadcrumbEntry[] = []

export function trackAction(action: string, page?: string) {
  _crumbs.push({
    action,
    page: page || (typeof window !== 'undefined' ? window.location.pathname : ''),
    timestamp: new Date().toISOString(),
  })
  if (_crumbs.length > MAX_ACTIONS) _crumbs.shift()
}

export function getBreadcrumb(): BreadcrumbEntry[] {
  return [..._crumbs]
}

export function clearBreadcrumb() {
  _crumbs = []
}
