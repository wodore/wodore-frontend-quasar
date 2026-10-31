/**
 * THE ONLY backend-taxonomy module — domains and kind parents.
 *
 * Owner decision (work doc §2.8): the frontend may rely on the geoplace
 * domain vocabulary and kind PARENTS being known/stable, and that
 * knowledge lives HERE and nowhere else. Everything else consumes this
 * module; unknown values fail open to the geoplace-default
 * presentation (never a blank screen).
 *
 * Note on kind parents: the wire's `CategoryKindRefSchema` has NO
 * `parent` member — the parent is the IDENTIFIER PREFIX
 * (`'accommodation.hut'` → `'accommodation'`), derived here.
 */

/** Geoplace super-root domains observed on the wire (search rows,
 *  details, MVT props). `'none'` is the tier fallback value. */
export const GEOPLACE_DOMAINS = ['amenity', 'admin', 'natural', 'none'] as const;

export type GeoplaceDomain = (typeof GEOPLACE_DOMAINS)[number] | (string & {});

/** Canonical id → presentation-source families (flat strings; a prefix
 *  convention may be introduced with the future `/my/*` auth entries). */
export const SOURCES = {
  /** Backend geoplace model (search, details, overlays MVT). */
  geoplace: 'geoplace',
  /** External transport layer (own property shapes, never geoplace types). */
  transport: 'transport',
} as const;

/** Wire shape of the `kind` member (subset of CategoryKindRefSchema the
 *  taxonomy reads — kept structural so MVT/search/probe payloads all fit). */
export interface KindRefLike {
  identifier?: string | null;
  slug?: string | null;
}

/**
 * Derive the kind parent from the identifier prefix — the ONLY correct
 * way to answer "is this an accommodation?" (the wire has no parent).
 * Returns null for missing/identifier-less kinds.
 */
export function kindParentOf(kind: KindRefLike | null | undefined): string | null {
  const identifier = kind?.identifier;
  if (!identifier) return null;
  const dot = identifier.indexOf('.');
  return dot === -1 ? identifier : identifier.slice(0, dot);
}

/** Kind identifier or slug equality against a match value. */
export function kindEquals(
  kind: KindRefLike | null | undefined,
  expected: string
): boolean {
  return kind?.identifier === expected || kind?.slug === expected;
}

/** Whether a domain value is in the known vocabulary (diagnostics only —
 *  unknown domains must NOT be rejected, they fail open). */
export function isKnownDomain(domain: unknown): domain is GeoplaceDomain {
  return typeof domain === 'string' && (GEOPLACE_DOMAINS as readonly string[]).includes(domain);
}
