// @vitest-environment happy-dom
//
// WdGeoLink — the popup geo: affordance (amenity, cluster, transport
// popups): the geo:lat,lon URL pattern shared with the place detail's
// location row and the mobile actions toolbar, icon-only by default with
// the coordinates label available. Mounted with a real vue-i18n instance
// reading the ACTUAL locale files, so a missing key fails here too.
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createI18n } from 'vue-i18n';
import WdGeoLink from '@components/map/WdGeoLink.vue';
import en from '@/i18n/locales/en.json';
import de from '@/i18n/locales/de.json';

function render(props: { lat: number; lon: number; label?: boolean }): {
  html: string;
  text: string;
} {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en, de },
  });
  const app = createApp({ render: () => h(WdGeoLink, props) });
  app.use(i18n);
  // Quasar icon stub — the real glyph is irrelevant to the link contract
  app.component('q-icon', { template: '<i class="q-icon" />' });
  const el = document.createElement('div');
  document.body.appendChild(el);
  app.mount(el);
  const anchor = el.querySelector('a.wd-geo-link');
  // anchor must exist for the assertions to be meaningful
  if (!anchor) {
    app.unmount();
    el.remove();
    throw new Error(`wd-geo-link anchor not rendered: ${el.innerHTML}`);
  }
  const out = { html: anchor.outerHTML, text: anchor.textContent ?? '' };
  app.unmount();
  el.remove();
  return out;
}

describe('WdGeoLink', () => {
  it('renders the geo: URL pattern (lat,lon, new tab)', () => {
    const { html } = render({ lat: 46.0207, lon: 7.7491 });
    expect(html).toContain('href="geo:46.0207,7.7491"');
    expect(html).toContain('target="_blank"');
  });

  it('carries the localized aria-label from the real locale files', () => {
    const { html } = render({ lat: 46.0207, lon: 7.7491 });
    expect(html).toContain('aria-label="Open in maps app"');
    expect(en.place.geo.aria).toBe('Open in maps app');
    expect(de.place.geo.aria).toBe('In Karten-App öffnen');
  });

  it('is icon-only by default; the label variant appends coordinates', () => {
    // the label check looks at the VISIBLE text — the href always
    // carries the coordinates by design
    const iconOnly = render({ lat: 47.3769, lon: 8.5417 });
    expect(iconOnly.html).toContain('href="geo:47.3769,8.5417"');
    expect(iconOnly.text).toBe('');
    const labeled = render({ lat: 47.3769, lon: 8.5417, label: true });
    expect(labeled.text).toContain('47.3769');
    expect(labeled.text).toContain('8.5417');
  });
});
