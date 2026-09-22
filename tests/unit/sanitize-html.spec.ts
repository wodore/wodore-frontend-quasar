// @vitest-environment jsdom
// (happy-dom strips <a> tags under DOMPurify - interop quirk; jsdom is
// DOMPurify's reference environment and matches real-browser behavior)
import { describe, it, expect } from 'vitest';
import * as allure from 'allure-js-commons';
import { sanitizeHtml } from '@/utils/sanitize-html';

/** Real attribution payload from the images API (Camptocamp provider). */
const CAMPTOCAMP_ATTRIBUTION =
  '<a href="https://creativecommons.org/licenses/by-sa/3.0/deed.de" target="_blank">CC-BY-SA-3.0</a> · Christian ' +
  '<img src="http://192.168.1.50:8079/D31xCBEHKjoRFTgKwx20kImFqLWNxgwqhLO740x16vU=/128x128/filters:quality(85)/media%2Forganizations%2Flogos%2Fcamptocamp_icon.png" alt="Camptocamp" style="height:15px; vertical-align: middle;">';

describe('sanitizeHtml', () => {
  it('keeps license links and provider logos with inline styles intact', () => {
    allure.label('feature', 'sanitize-html');
    allure.severity('critical');

    const clean = sanitizeHtml(CAMPTOCAMP_ATTRIBUTION);

    // Link survives with href and target
    expect(clean).toContain('<a href="https://creativecommons.org/licenses/by-sa/3.0/deed.de"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('>CC-BY-SA-3.0</a>');
    // Provider logo survives with src, alt and the inline style
    expect(clean).toContain('<img');
    expect(clean).toContain('src="http://192.168.1.50:8079/');
    expect(clean).toContain('alt="Camptocamp"');
    expect(clean).toContain('height:15px');
    expect(clean).toContain('vertical-align: middle');
    // Author name text
    expect(clean).toContain('Christian');
  });

  it('adds noopener to links opening a new tab', () => {
    const clean = sanitizeHtml(CAMPTOCAMP_ATTRIBUTION);
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });

  it('strips script tags and event handlers', () => {
    const dirty =
      '<span onclick="alert(1)">author</span><script>alert(2)</script><img src="x.png" onerror="alert(3)">';

    const clean = sanitizeHtml(dirty);

    expect(clean).not.toContain('script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('onerror');
    // the span content itself survives
    expect(clean).toContain('author');
    // img survives but only with its src
    expect(clean).toContain('src="x.png"');
  });

  it('removes javascript: URLs', () => {
    const clean = sanitizeHtml('<a href="javascript:alert(1)">click</a>');

    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('click');
  });
});
