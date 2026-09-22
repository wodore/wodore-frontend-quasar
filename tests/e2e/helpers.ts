/**
 * Shared helpers for the local e2e smoke suite.
 *
 * The suite runs against the REAL dev server (default http://localhost:9000,
 * started manually with `yarn dev`) and is intentionally NOT part of CI.
 */
import { APIRequestContext } from '@playwright/test';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:9000';
export const API_URL = process.env.E2E_API_HOST ?? 'http://127.0.0.1:8000';
export const HUT_SLUG = process.env.E2E_HUT_SLUG ?? 'aarbiwak';

/**
 * Fails fast with an actionable message when no dev server is listening,
 * instead of every test timing out one by one.
 */
export async function requireDevServer(): Promise<void> {
  try {
    const response = await fetch(BASE_URL, {
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    // Any HTTP answer (even an error page) means the dev server is up
    if (response.status < 500) return;
    throw new Error(`Dev server answered with HTTP ${response.status}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Dev server not reachable at ${BASE_URL} (${reason}).\n` +
        'The e2e suite runs against the real dev server — start it first with: yarn dev'
    );
  }
}

/**
 * Looks up the test hut via the backend API to decide whether the hut detail
 * test can run. Returns the hut name (for content assertions) when found.
 * Retries once on transient failures to avoid flaky skips.
 */
export async function lookupHut(
  request: APIRequestContext,
  slug: string
): Promise<{ exists: boolean; name?: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await request.get(`${API_URL}/v1/huts/${slug}`, {
        timeout: 8000,
        failOnStatusCode: false,
      });
      if (response.ok()) {
        const hut = (await response.json()) as { name?: string };
        return { exists: true, name: hut.name };
      }
      if (response.status() >= 500 && attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      return { exists: false };
    } catch {
      if (attempt === 1) return { exists: false };
    }
  }
  return { exists: false };
}
