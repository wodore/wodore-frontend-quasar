// @vitest-environment happy-dom
/** Debug-tools flag service: the localStorage flag is the single source
 *  of truth; the ?debug=1|0 param seeds/clears it at boot and STAYS in
 *  the URL (sticky debug link). The switch keeps an existing param in
 *  sync but never introduces one. */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isDebugEnabled,
  setDebugEnabled,
  isPreviewEnv,
  applyDebugParam,
  syncDebugParam,
  setKnobCookie,
  readKnobCookie,
  disableDebugTools,
} from '@services/debug-tools';

function setUrl(pathAndQuery: string): void {
  window.history.replaceState(null, '', pathAndQuery);
}

describe('debug-tools flag', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__WODORE_RUNTIME_ENV__;
  });

  it('flag defaults to off', () => {
    expect(isDebugEnabled()).toBe(false);
  });

  it('setDebugEnabled persists and clears', () => {
    setDebugEnabled(true);
    expect(isDebugEnabled()).toBe(true);
    expect(localStorage.getItem('wodore:debug')).toBe('1');
    setDebugEnabled(false);
    expect(isDebugEnabled()).toBe(false);
    expect(localStorage.getItem('wodore:debug')).toBeNull();
  });

  it('isPreviewEnv mirrors the staging/preview ribbon gate', () => {
    expect(isPreviewEnv()).toBe(false);
    window.__WODORE_RUNTIME_ENV__ = { WODORE_ENV: 'staging' };
    expect(isPreviewEnv()).toBe(true);
    window.__WODORE_RUNTIME_ENV__ = { WODORE_ENV: 'preview' };
    expect(isPreviewEnv()).toBe(true);
    window.__WODORE_RUNTIME_ENV__ = { WODORE_ENV: 'production' };
    expect(isPreviewEnv()).toBe(false);
  });
});

describe('debug-tools ?debug param (boot)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('?debug=1 sets the flag and STAYS in the URL (sticky debug link)', () => {
    setUrl('/?debug=1&foo=bar');
    expect(applyDebugParam()).toBe('1');
    expect(isDebugEnabled()).toBe(true);
    expect(window.location.search).toBe('?debug=1&foo=bar');
  });

  it('?debug=0 clears the flag and stays', () => {
    setDebugEnabled(true);
    setUrl('/hut/aarbiwak?debug=0#map=6/47/8');
    expect(applyDebugParam()).toBe('0');
    expect(isDebugEnabled()).toBe(false);
    expect(window.location.search).toBe('?debug=0');
    expect(window.location.hash).toBe('#map=6/47/8');
  });

  it('no param: returns null and leaves flag and URL untouched', () => {
    setUrl('/?v=9');
    expect(applyDebugParam()).toBeNull();
    expect(isDebugEnabled()).toBe(false);
    expect(window.location.search).toBe('?v=9');
  });
});

describe('debug-tools switch-side URL sync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('updates an EXISTING ?debug param in place, preserving the rest', () => {
    setUrl('/hut/aarbiwak?debug=1&date=30.10.26#map=6/47/8');
    syncDebugParam(false);
    expect(window.location.search).toBe('?debug=0&date=30.10.26');
    expect(window.location.hash).toBe('#map=6/47/8');
    syncDebugParam(true);
    expect(window.location.search).toBe('?debug=1&date=30.10.26');
  });

  it('never introduces the param when absent', () => {
    setUrl('/?v=9');
    syncDebugParam(true);
    expect(window.location.search).toBe('?v=9');
  });
});

describe('debug-tools knob cookies (net/cache)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'wd-net=; Path=/; Max-Age=0';
    document.cookie = 'wd-cache=; Path=/; Max-Age=0';
  });

  it('set/read round-trips a knob value', () => {
    setKnobCookie('wd-net', 'slow3g');
    expect(readKnobCookie('wd-net')).toBe('slow3g');
    setKnobCookie('wd-net', null);
    expect(readKnobCookie('wd-net')).toBeNull();
  });

  it('disableDebugTools tears the knobs down with the flag', () => {
    setDebugEnabled(true);
    setKnobCookie('wd-net', 'slow3g');
    setKnobCookie('wd-cache', 'off');
    disableDebugTools();
    expect(isDebugEnabled()).toBe(false);
    expect(readKnobCookie('wd-net')).toBeNull();
    expect(readKnobCookie('wd-cache')).toBeNull();
  });
});
