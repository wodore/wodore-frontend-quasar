/**
 * Group switch must update the MAP, not just the store — regression test.
 *
 * Tapping the group cycle button changes overlay.active flags in the
 * store; the map has to follow. The original bug: only visibility was
 * re-applied, so layers that became active but had never been ADDED to
 * the map (a group whose layers were untouched since load) never
 * appeared — the map went stale until the next manual toggle.
 *
 * Invariant asserted after every switch: for every overlay,
 *   active  → its style layers exist on the map and are visible
 *   passive → its layers on the map (if any) are set to none
 */
import { test, expect } from '@playwright/test';
import { loadMap, tagTest, attachScreenshot, evalJSON, GET_MAP } from './helpers';

const OVERLAY_STATE_VS_MAP = `
(() => {
  const map = ${GET_MAP};
  const styleLayers = map.getStyle().layers;
  const pinia = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia;
  const store = pinia._s.get('overlay');
  const mismatches = [];
  for (const o of store.overlays) {
    if (o.show === false) continue;
    for (const l of o.style.layers) {
      const ml = styleLayers.find(x => x.id === l.id);
      if (o.active && !ml) {
        mismatches.push(o.name + '/' + l.id + ': active but MISSING from map');
      } else if (ml) {
        const vis = (ml.layout && ml.layout.visibility) || 'visible';
        const want = o.active ? 'visible' : 'none';
        if (vis !== want) mismatches.push(o.name + '/' + l.id + ': ' + vis + ' wanted ' + want);
      }
    }
  }
  return { mismatches, active: store.overlays.filter(o => o.active).map(o => o.name) };
})()
`;

test.describe('group switching updates the map', () => {
  // Map layer bookkeeping is theme-independent — one mobile config covers
  // the regression; the widget chrome is themed by the other specs.
  test('light-mobile: cycled groups keep map layers in sync', async ({ page }, testInfo) => {
    tagTest('light', 'mobile', 'group-switch');
    test.setTimeout(90_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await loadMap(page);

    // Baseline after initial load: store and map agree
    const baseline = await evalJSON<{ mismatches: string[] }>(page, OVERLAY_STATE_VS_MAP);
    expect(baseline.mismatches).toEqual([]);

    // Expand so the group cycle button is reachable
    await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
    await page.waitForTimeout(700);

    // Seed: activate the first group row so the current group has a
    // KNOWN active layer — cycling back to it must re-add/keep it on the
    // map (the regression path: layers not touched since load)
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.wd-ovl__rows .wd-ovl__row')];
      const row = rows.find(r => !r.classList.contains('wd-ovl__row--other') && r.classList.contains('wd-ovl__row--passive'));
      row?.click();
    });
    await page.waitForTimeout(700);
    const seeded = await evalJSON<{ mismatches: string[]; active: string[] }>(page, OVERLAY_STATE_VS_MAP);
    expect(seeded.mismatches).toEqual([]);
    const seedCount = seeded.active.length;
    expect(seedCount, 'seeded group has active layers').toBeGreaterThan(0);

    // Seed 2 — the REGRESSION scenario: a group whose SAVED actives (from a
    // previous session) include a layer never added to the map this session.
    // Store-level seed: next group's first member is its only active layer.
    // The buggy code only re-applied visibility → that layer stayed MISSING
    // from the map; the fix ADDS it.
    await page.evaluate(() => {
      const pinia = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia;
      const store = pinia._s.get('overlay');
      const next = store.groupSettings.groups.find(
        g => g.id !== store.groupSettings.activeGroupId && !g.removed && !g.hidden && g.layerSlugs.length > 0
      );
      const member = next.layerSlugs.find(slug => {
        const o = store.overlays.find(x => x.name === slug);
        return o && o.show !== false && !o.active;
      });
      next.activeLayerSlugs = member ? [member] : [];
      window.__seededNextGroup = next.id;
      window.__seededMember = member ?? null;
    });

    // Cycle through every group — each landed state must match the map.
    // Fresh default groups may have zero active layers (empty is a valid
    // synced state), so the >0 check runs on the seeded states.
    let sawSeededMemberActive = false;
    for (let i = 0; i < 3; i++) {
      await page.evaluate('document.querySelector(".wd-ovl__group-btn")?.click()');
      await page.waitForTimeout(900);
      const state = await evalJSON<{ mismatches: string[]; active: string[] }>(
        page,
        OVERLAY_STATE_VS_MAP
      );
      await attachScreenshot(page, testInfo, `light-mobile-switch-${i}`);
      // Report the full mismatch list on failure — one broken layer is enough
      expect(state.mismatches, `after group switch #${i + 1}`).toEqual([]);
      if (await page.evaluate('window.__seededMember && document.querySelector("#q-app").__vue_app__.config.globalProperties.$pinia._s.get("overlay").groupSettings.activeGroupId === window.__seededNextGroup')) {
        const memberActive = await page.evaluate(
          'window.__seededMember && document.querySelector("#q-app").__vue_app__.config.globalProperties.$pinia._s.get("overlay").overlays.find(o => o.name === window.__seededMember)?.active === true'
        );
        if (memberActive) sawSeededMemberActive = true;
      }
    }
    expect(sawSeededMemberActive, 'the seeded next-group member became active on its group (exercising the add path)').toBe(true);
    expect(seedCount, 'returned with the seeded group layers active').toBeGreaterThan(0);
  });

  test('light-mobile: title dropdown switches groups, map stays in sync', async ({ page }, testInfo) => {
    tagTest('light', 'mobile', 'group-switch');
    test.setTimeout(90_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await loadMap(page);
    await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
    await page.waitForTimeout(700);

    // Open the title dropdown and pick a DIFFERENT group
    const picked = await page.evaluate(() => {
      const btn = document.querySelector('.wd-ovl__toolbar-title--menu');
      if (!btn) return null;
      btn.click();
      return true;
    });
    expect(picked, 'title dropdown button exists (expanded)').toBe(true);
    await page.waitForTimeout(500);
    const switched = await page.evaluate(() => {
      const pinia = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia;
      const store = pinia._s.get('overlay');
      const current = store.groupSettings.activeGroupId;
      const items = [...document.querySelectorAll('.wd-ovl__group-menu .q-item')];
      const target = items.find(i => !i.classList.contains('wd-ovl__group-menu-item--active'));
      if (!target) return false;
      target.click();
      window.__prevGroup = current;
      return true;
    });
    expect(switched, 'dropdown lists other groups').toBe(true);
    await page.waitForTimeout(900);

    const changed = await page.evaluate(() => {
      const pinia = document.querySelector('#q-app').__vue_app__.config.globalProperties.$pinia;
      return pinia._s.get('overlay').groupSettings.activeGroupId !== window.__prevGroup;
    });
    expect(changed, 'active group changed via dropdown').toBe(true);

    const state = await evalJSON<{ mismatches: string[] }>(page, OVERLAY_STATE_VS_MAP);
    await attachScreenshot(page, testInfo, 'light-mobile-dropdown-switch');
    expect(state.mismatches, 'map matches store after dropdown switch').toEqual([]);
  });
});
