// @vitest-environment happy-dom
/**
 * rendererProfile (services/gpu-override) — the session's renderer
 * capability profile for the overlay catalog (backend #440): 'subset'
 * on no-WebGL/fallback sessions (the same signal WdMapView uses to
 * mount WdFallbackMapView), undefined for MapLibre sessions. Synchronous
 * by design — the catalog store keys its OVERLAY fetch off it before
 * any await.
 *
 * happy-dom: the probe needs a document; happy-dom ships no WebGL, so
 * an un-stubbed canvas reads as a fallback (subset) session — the
 * WebGL-capable cases stub HTMLCanvasElement.getContext.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { rendererProfile } from '@services/gpu-override';

/** Stub the WebGL probe: truthy context object vs null, or throwing. */
function stubCanvasContext(behavior: 'webgl' | 'none' | 'throws'): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    if (behavior === 'webgl') return {} as WebGLRenderingContext;
    if (behavior === 'throws') throw new Error('blocked by policy');
    return null;
  });
}

describe('rendererProfile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.href = 'http://localhost/';
  });

  it('maps the ?gpuTier=-1 override to subset — WebGL capability irrelevant', () => {
    stubCanvasContext('webgl');
    window.location.href = 'http://localhost/?gpuTier=-1';
    expect(rendererProfile()).toBe('subset');
  });

  it('a tier override on a WebGL-capable session stays default (undefined)', () => {
    window.location.href = 'http://localhost/?gpuTier=0';
    stubCanvasContext('webgl');
    expect(rendererProfile()).toBeUndefined();
  });

  it('a WebGL-capable machine without overrides declares nothing', () => {
    stubCanvasContext('webgl');
    expect(rendererProfile()).toBeUndefined();
  });

  it('no WebGL context → subset (the no-WebGL fallback session)', () => {
    stubCanvasContext('none');
    expect(rendererProfile()).toBe('subset');
  });

  it('a throwing probe → subset (never crash the boot)', () => {
    stubCanvasContext('throws');
    expect(rendererProfile()).toBe('subset');
  });

  it('happy-dom itself has no WebGL — the un-stubbed default is a subset session', () => {
    // Documents the store specs' environment: their initOverlays runs
    // fetch with profile 'subset' because of exactly this.
    expect(rendererProfile()).toBe('subset');
  });
});
