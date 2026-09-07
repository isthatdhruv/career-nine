/**
 * Indian city catalogue for demographic "city" fields.
 *
 * The list is a static asset (public/catalogues/india-cities.json, regenerate
 * with scripts/build-city-catalogue.sh) served from the app's own CDN and
 * fetched lazily — only when a demographics page actually renders a city
 * field, and at most once per page load. The field itself stays an ordinary
 * TEXT custom field: the chosen entry is saved as plain text ("Indore, Madhya
 * Pradesh"), so nothing changes on the backend, in exports or in dashboards.
 */

export const CITY_CATALOGUE_URL = "/catalogues/india-cities.json"

type CatalogueDoc = {
  states: Record<string, string>
  /** [asciiName, admin1Code] pairs, population-sorted (prominent first). */
  cities: [string, string][]
}

export type CityEntry = {
  /** Display / stored value, e.g. "Indore, Madhya Pradesh". */
  label: string
  /** Lower-cased city name for matching. */
  key: string
  /** Lower-cased state name for matching ("indore mp" style queries are not supported; state helps "jaipur raj"). */
  stateKey: string
}

/**
 * A demographic field is treated as a city field when it is a TEXT field whose
 * field name or label contains the word "city" (word-bounded, so "Ethnicity"
 * does not match). Convention over configuration: no schema change needed.
 */
export function isCityField(field: { dataType: string; fieldName: string; displayLabel: string; customLabel?: string | null }): boolean {
  if (field.dataType !== "TEXT") return false
  const plain = (s: string | null | undefined) => (s || "").replace(/<[^>]*>/g, "")
  return /\bcity\b/i.test(plain(field.fieldName)) || /\bcity\b/i.test(plain(field.customLabel || field.displayLabel))
}

let cache: Promise<CityEntry[]> | null = null

/** Loads the catalogue once; concurrent callers share the same promise. */
export function loadCityCatalogue(): Promise<CityEntry[]> {
  if (!cache) {
    cache = fetch(CITY_CATALOGUE_URL, { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`city catalogue ${r.status}`)
        return r.json() as Promise<CatalogueDoc>
      })
      .then((doc) =>
        doc.cities.map(([name, code]) => {
          const state = doc.states[code] || ""
          return { label: state ? `${name}, ${state}` : name, key: name.toLowerCase(), stateKey: state.toLowerCase() }
        })
      )
      .catch((err) => {
        cache = null // allow a retry on the next keystroke
        throw err
      })
  }
  return cache
}

/**
 * Prefix matches first (population order preserved), then in-word matches,
 * then state-name matches — capped at `limit`.
 */
export function searchCities(entries: CityEntry[], query: string, limit = 8): CityEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const prefix: CityEntry[] = []
  const inner: CityEntry[] = []
  const byState: CityEntry[] = []
  for (const e of entries) {
    if (e.key.startsWith(q)) prefix.push(e)
    else if (e.key.includes(q)) inner.push(e)
    else if (e.stateKey.startsWith(q)) byState.push(e)
    if (prefix.length >= limit) break
  }
  return [...prefix, ...inner, ...byState].slice(0, limit)
}
