/**
 * Presentation registry — first matching entry wins; the entries array
 * order documents precedence (no numeric specificity scores).
 *
 * Resolution is a synchronous declarative-match chain, memoized by
 * `target.key` so re-assigning an equal target never re-runs matchers or
 * rebuilds async components. Unknown sources resolve to `undefined` with
 * a dev-only warning (fail-open is handled by the geoplace-default ENTRY
 * catching every geoplace target — place it last).
 */
import type { MapTarget, MatchSpec, Presentation } from './types';
import { kindParentOf, kindEquals } from './taxonomy';

/** Resolve a MatchSpec against a target — pure data-in/boolean-out. */
export function matchSpec(spec: MatchSpec, target: MapTarget): boolean {
  if (target.source !== spec.source) return false;

  const props = target.props;

  if (spec.domain !== undefined) {
    const domain = props.domain;
    if (typeof domain !== 'string') return false;
    if (typeof spec.domain === 'string' ? domain !== spec.domain : !spec.domain.includes(domain)) {
      return false;
    }
  }

  if (spec.kindParent !== undefined) {
    const parent = kindParentOf(kindOf(props));
    if (parent === null) return false;
    if (
      typeof spec.kindParent === 'string'
        ? parent !== spec.kindParent
        : !spec.kindParent.includes(parent)
    ) {
      return false;
    }
  }

  if (spec.kind !== undefined) {
    const kind = kindOf(props);
    if (!kind) return false;
    const matches =
      typeof spec.kind === 'string'
        ? kindEquals(kind, spec.kind)
        : spec.kind.some(k => kindEquals(kind, k));
    if (!matches) return false;
  }

  if (spec.where && !spec.where(target)) return false;

  return true;
}

/** Structural read of a `kind` member from a wire bag (search row,
 *  probe, MVT props). */
function kindOf(props: Record<string, unknown>): { identifier?: string | null; slug?: string | null } | null {
  const kind = props.kind;
  if (typeof kind !== 'object' || kind === null) return null;
  return kind as { identifier?: string | null; slug?: string | null };
}

export interface Registry {
  /** First matching entry for the target, memoized by `target.key`;
   *  `undefined` when nothing matches (dev-only warning). */
  resolve(target: MapTarget): Presentation | undefined;
  /** All entries (ordered) — read access for tooling/tests. */
  entries(): readonly Presentation[];
  /** Drop the memo cache (tests / registry swaps). */
  clearMemo(): void;
}

/** Build a registry from an ordered entry array (first-wins). Tests and
 *  Histoire build scoped registries via this factory; the app uses the
 *  default registry from `entries/index.ts`. */
export function createRegistry(list: readonly Presentation[]): Registry {
  const memo = new Map<string, Presentation | undefined>();
  return {
    resolve(target: MapTarget): Presentation | undefined {
      const cached = memo.get(target.key);
      if (cached !== undefined || memo.has(target.key)) return cached;

      let resolved: Presentation | undefined;
      for (const entry of list) {
        if (matchSpec(entry.match, target)) {
          resolved = entry;
          break;
        }
      }
      if (resolved === undefined && import.meta.env.DEV) {
        // Fail-open diagnostics: an unmatched non-geoplace source usually
        // means an entry's MatchSpec drifted from the wire (e.g. typo'd
        // kindParent) — clicks on it silently no-op in production.
        console.warn(
          `[selection] no presentation matched target ${target.key} (source '${target.source}', domain '${String(target.props.domain)}')`
        );
      }
      // Simple bounded memo: targets per session are few; drop everything
      // rather than growing unbounded across long sessions.
      if (memo.size > 500) memo.clear();
      memo.set(target.key, resolved);
      return resolved;
    },
    entries: () => list,
    clearMemo: () => memo.clear(),
  };
}
