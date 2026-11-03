//
// Spatial near lookups (services/cluster-members.ts): the two-mode
// endpoint contract (cluster members / what's here) and the defensive
// response mapping.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.WODORE_API_HOST = 'http://api.test';
  process.env.WODORE_PUBLIC_API_URL = '';
});

const fetchMock = vi.hoisted(() =>
  vi.fn(async (): Promise<Response> => new Response('[]', { status: 200 }))
);
vi.stubGlobal('fetch', fetchMock);
const mocked = vi.mocked(fetchMock);

import { fetchClusterMembers, fetchWhatsHere } from '@services/cluster-members';

const lastUrl = (): URL =>
  new URL((mocked.mock.lastCall as unknown as [Request | URL])[0] as never);

/** Default fetch body for a call (mutable per test). */
let responseBody = '{"data":[],"count":0}';

beforeEach(() => {
  mocked.mockReset();
  mocked.mockImplementation(async () => new Response(responseBody, { status: 200 }));
});

describe('fetchClusterMembers (cluster mode: exact tile-grid snap)', () => {
  it('sends z (tile zoom), category_tree, limit and the field projection', async () => {
    responseBody = '{"data":[],"count":0}';
    await fetchClusterMembers({
      subtree: 'restaurant',
      lat: 47.3769,
      lon: 8.5417,
      tileZoom: 7,
      count: 3,
    });

    const url = lastUrl();
    expect(url.origin).toBe('http://api.test');
    expect(url.pathname).toBe('/v1/geoplaces/near');
    expect(url.searchParams.get('lat')).toBe('47.3769');
    expect(url.searchParams.get('lon')).toBe('8.5417');
    expect(url.searchParams.get('z')).toBe('7');
    expect(url.searchParams.get('category_tree')).toBe('restaurant');
    expect(url.searchParams.get('limit')).toBe('3');
    expect(url.searchParams.get('fields')).toBe(
      'slug,name,importance,category_identifier,color,parent_color,elevation'
    );
    expect(url.searchParams.get('lang')).toBeTruthy();
    // proximity-mode params are NOT sent in cluster mode
    expect(url.searchParams.get('radius')).toBeNull();
    expect(url.searchParams.get('order')).toBeNull();
  });

  it('forwards the overlay tile-URL cluster params verbatim', async () => {
    await fetchClusterMembers({
      subtree: 'restaurant',
      lat: 47.3769,
      lon: 8.5417,
      tileZoom: 7,
      count: 2,
      nearParams: { cluster_max_zoom: '7', cluster_radius_m: '5000' },
    });
    const url = lastUrl();
    expect(url.searchParams.get('cluster_max_zoom')).toBe('7');
    expect(url.searchParams.get('cluster_radius_m')).toBe('5000');
  });

  it('maps the accommodations subtree onto the accommodation category tree', async () => {
    await fetchClusterMembers({
      subtree: 'accommodations',
      lat: 46.5,
      lon: 8.0,
      tileZoom: 8,
      count: 2,
    });
    expect(lastUrl().searchParams.get('category_tree')).toBe('accommodation');
  });

  it('returns the endpoint count (total before limit) for consistency checks', async () => {
    responseBody = JSON.stringify({
      data: [{ slug: 'a-1', name: 'A' }],
      count: 3,
    });
    const result = await fetchClusterMembers({
      subtree: 'restaurant',
      lat: 46.5,
      lon: 8.0,
      tileZoom: 8,
      count: 3,
    });
    expect(result.count).toBe(3);
    expect(result.places).toHaveLength(1);
  });

  it('maps member rows (slug, name, identifier, colors, elevation)', async () => {
    responseBody = JSON.stringify({
      data: [
        {
          slug: 'zeujausse-1a',
          name: 'Restaurant Zeujausse',
          elevation: 2311,
          importance: 60,
          category_identifier: 'restaurant.restaurant',
          color: '#4B8E43',
          parent_color: '#77AA77',
        },
        {
          slug: 'berghlare-qtxgh',
          name: 'Berghotel Laresch',
          elevation: null,
          category_identifier: 'accommodation.bhotel',
        },
      ],
      count: 2,
    });
    const result = await fetchClusterMembers({
      subtree: 'restaurant',
      lat: 46.5,
      lon: 8.0,
      tileZoom: 8,
      count: 2,
    });
    expect(result.places).toEqual([
      {
        slug: 'zeujausse-1a',
        name: 'Restaurant Zeujausse',
        importance: 60,
        identifier: 'restaurant.restaurant',
        color: '#4B8E43',
        parentColor: '#77AA77',
        elevation: 2311,
      },
      {
        slug: 'berghlare-qtxgh',
        name: 'Berghotel Laresch',
        elevation: null,
        identifier: 'accommodation.bhotel',
      },
    ]);
  });
});

describe('fetchWhatsHere (proximity mode)', () => {
  it('sends radius + distance ordering, no zoom/category (pure proximity)', async () => {
    responseBody = '{"data":[],"count":0}';
    await fetchWhatsHere({ lat: 47.1, lon: 8.4 });

    const url = lastUrl();
    expect(url.pathname).toBe('/v1/geoplaces/near');
    expect(url.searchParams.get('lat')).toBe('47.1');
    expect(url.searchParams.get('lon')).toBe('8.4');
    expect(url.searchParams.get('radius')).toBe('50');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('order')).toBe('distance');
    // cluster-mode params are NOT sent in proximity mode
    expect(url.searchParams.get('z')).toBeNull();
    expect(url.searchParams.get('category_tree')).toBeNull();
    expect(url.searchParams.get('cluster_max_zoom')).toBeNull();
  });

  it('tolerates bare-array envelopes, drops unusable rows', async () => {
    responseBody = JSON.stringify([
      { slug: 'a-1', name: 'A' },
      { slug: '', name: 'No slug' },
      { name: 'No slug either' },
      'garbage',
    ]);
    const result = await fetchWhatsHere({ lat: 46.5, lon: 8.0 });
    expect(result.places).toEqual([{ slug: 'a-1', name: 'A', elevation: null }]);
    expect(result.count).toBe(1);
  });
});

describe('shared error handling', () => {
  it('throws on non-2xx responses', async () => {
    mocked.mockImplementation(async () => new Response('{"detail":"nope"}', { status: 500 }));
    await expect(fetchWhatsHere({ lat: 46.5, lon: 8.0 })).rejects.toThrow('500');
  });
});
