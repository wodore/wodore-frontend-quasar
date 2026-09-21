import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as allure from 'allure-js-commons';
import getImageUrl from '@services/imageService';

const ORIGINAL_ENV = { ...process.env };

function setEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('getImageUrl', () => {
  beforeAll(() => {
    setEnv({
      WODORE_IMAGOR_URL: 'http://img.test',
      WODORE_IMAGOR_KEY: 'test-key',
      WODORE_API_HOST: undefined,
      WODORE_IMAGOR_REPLACE_API_HOST_MEDIA: undefined,
    });
  });

  afterAll(() => {
    // Restore the original environment for other test files in this worker
    for (const key of Object.keys(ORIGINAL_ENV)) {
      process.env[key] = ORIGINAL_ENV[key];
    }
  });

  it('builds a signed URL with the default size', () => {
    allure.label('feature', 'image-service');
    allure.severity('critical');

    const url = getImageUrl('media/huts/photo.jpg');

    expect(url).toMatch(/^http:\/\/img\.test\//);
    expect(url).toContain('/600x400/');
    expect(url).toContain(encodeURIComponent('media/huts/photo.jpg'));
  });

  it('produces a base64url signature (no + or /)', () => {
    const url = getImageUrl('media/huts/photo.jpg');
    const hash = url.split('/').slice(3, 4)[0]; // strip host + hash

    expect(hash).toMatch(/^[A-Za-z0-9-_]+={0,2}$/);
    expect(hash).not.toContain('unsafe');
  });

  it('uses the unsafe marker when requested', () => {
    const url = getImageUrl('media/huts/photo.jpg', { size: '300x200', unsafe: true });

    expect(url).toContain('/unsafe/300x200/');
  });

  it('is deterministic for identical input', () => {
    const a = getImageUrl('media/huts/photo.jpg', { size: '300x200' });
    const b = getImageUrl('media/huts/photo.jpg', { size: '300x200' });

    expect(a).toBe(b);
  });

  it('appends focal and quality filters in a stable order', () => {
    const url = getImageUrl('media/huts/photo.jpg', {
      size: '600x400',
      focal: '0.1,0.8',
      quality: 80,
    });

    expect(url).toContain('/filters:focal(0.1,0.8):quality(80)/');
  });

  it('computes the crop stop from size when only cropStart is given', () => {
    const url = getImageUrl('media/huts/photo.jpg', {
      size: '600x400',
      cropStart: '10x20',
    });

    expect(url).toContain('/10x20:610x420/');
  });

  it('strips the API media host prefix when replacement is enabled', () => {
    setEnv({ WODORE_API_HOST: 'http://api.test' });

    // Replacement target configured: path is prefixed with it
    setEnv({ WODORE_IMAGOR_REPLACE_API_HOST_MEDIA: 'media-cdn' });
    const replaced = getImageUrl('http://api.test/media/huts/photo.jpg');
    expect(replaced).toContain('/600x400/' + encodeURIComponent('media-cdn/huts/photo.jpg'));

    // Replacement enabled but no target: only the host prefix is stripped
    setEnv({ WODORE_IMAGOR_REPLACE_API_HOST_MEDIA: undefined });
    const stripped = getImageUrl('http://api.test/media/huts/photo.jpg');
    expect(stripped).toContain('/600x400/' + encodeURIComponent('huts/photo.jpg'));
  });

  it('keeps absolute API URLs when replacement is disabled', () => {
    setEnv({
      WODORE_API_HOST: 'http://api.test',
      WODORE_IMAGOR_REPLACE_API_HOST_MEDIA: 'disabled',
    });

    const url = getImageUrl('http://api.test/media/huts/photo.jpg');

    expect(url).toContain(encodeURIComponent('http://api.test/media/huts/photo.jpg'));
  });
});
