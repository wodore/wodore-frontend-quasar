import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as allure from 'allure-js-commons';
import polyline from '@mapbox/polyline';
import axios from 'axios';
import CustomRouteMode from '@services/customRouteMode';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

interface FakeMap {
  queryRenderedFeatures: ReturnType<typeof vi.fn>;
  fire: ReturnType<typeof vi.fn>;
  getSource: ReturnType<typeof vi.fn>;
  addSource: ReturnType<typeof vi.fn>;
  addLayer: ReturnType<typeof vi.fn>;
}

interface DrawContext {
  map: FakeMap;
  updateUIClasses: ReturnType<typeof vi.fn>;
  activateUIButton: ReturnType<typeof vi.fn>;
}

interface RouteState {
  coordinates: [number, number][];
  pointFeatures: unknown[];
  selectedPointId: string | null;
}

interface ClickEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
}

function makeMap(): FakeMap {
  return {
    queryRenderedFeatures: vi.fn(() => []),
    fire: vi.fn(),
    getSource: vi.fn(() => undefined),
    addSource: vi.fn(),
    addLayer: vi.fn(),
  };
}

function makeContext(): DrawContext {
  return {
    map: makeMap(),
    updateUIClasses: vi.fn(),
    activateUIButton: vi.fn(),
  };
}

function setup(ctx: DrawContext): RouteState {
  return (CustomRouteMode.onSetup as (this: DrawContext) => RouteState).call(ctx);
}

function click(ctx: DrawContext, state: RouteState, lng: number, lat: number): void {
  const event: ClickEvent = { lngLat: { lng, lat }, point: { x: 0, y: 0 } };
  (
    CustomRouteMode.onClick as unknown as (this: DrawContext, s: RouteState, e: ClickEvent) => void
  ).call(ctx, state, event);
}

function stop(ctx: DrawContext, state: RouteState): void {
  (CustomRouteMode.onStop as (this: DrawContext, s: RouteState) => void).call(ctx, state);
}

/** Valhalla-style response with a polyline6 shape of [lat, lng] pairs. */
function valhallaResponse(coords: [number, number][]): { data: unknown } {
  return { data: { trip: { legs: [{ shape: polyline.encode(coords, 6) }] } } };
}

describe('CustomRouteMode', () => {
  beforeEach(() => {
    vi.mocked(axios.post).mockReset();
  });

  it('sets up empty initial state', () => {
    allure.label('feature', 'custom-route-mode');
    allure.severity('critical');

    const ctx = makeContext();
    const state = setup(ctx);

    expect(state.coordinates).toEqual([]);
    expect(state.pointFeatures).toEqual([]);
    expect(state.selectedPointId).toBeNull();
  });

  it('adds a clicked point and fires an update event', () => {
    const ctx = makeContext();
    const state = setup(ctx);

    click(ctx, state, 7.75, 46.0);

    expect(state.coordinates).toEqual([[7.75, 46.0]]);
    expect(state.pointFeatures).toHaveLength(1);
    expect(ctx.map.fire).toHaveBeenCalledWith('draw.custom_route.update', {
      coordinates: [[7.75, 46.0]],
    });
    expect(ctx.updateUIClasses).toHaveBeenCalledWith({ mouse: 'add' });
    expect(ctx.activateUIButton).toHaveBeenCalledWith('custom_route');
    // Points are rendered as a circle layer on first click
    expect(ctx.map.addSource).toHaveBeenCalledWith(
      'points',
      expect.objectContaining({ type: 'geojson' })
    );
    expect(ctx.map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'points', type: 'circle', source: 'points' })
    );
    // A single point never triggers a routing request
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('fetches a route and displays it as a line once two points exist', async () => {
    vi.mocked(axios.post).mockResolvedValue(
      valhallaResponse([
        [46.0, 7.75],
        [46.1, 7.85],
      ]) as never
    );

    const ctx = makeContext();
    const state = setup(ctx);
    click(ctx, state, 7.75, 46.0);
    click(ctx, state, 7.85, 46.1);

    expect(axios.post).toHaveBeenCalledWith(
      'https://valhalla1.openstreetmap.de/route',
      expect.objectContaining({ costing: 'pedestrian', shape_format: 'polyline6' })
    );

    await vi.waitFor(() => {
      expect(ctx.map.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'route', type: 'line', source: 'route' })
      );
    });

    // Shape is decoded from [lat, lng] and stored as [lng, lat]
    expect(ctx.map.addSource).toHaveBeenCalledWith(
      'route',
      expect.objectContaining({
        type: 'geojson',
        data: expect.objectContaining({
          geometry: expect.objectContaining({
            coordinates: [
              [7.75, 46.0],
              [7.85, 46.1],
            ],
          }),
        }),
      })
    );
    const layer = ctx.map.addLayer.mock.calls.find(
      call => (call[0] as { id?: string }).id === 'route'
    )?.[0] as { paint?: Record<string, unknown> };
    expect(layer.paint).toMatchObject({ 'line-color': '#007cbf', 'line-width': 4 });
  });

  it('selects an existing point instead of adding a new one', () => {
    const ctx = makeContext();
    const state = setup(ctx);

    ctx.map.queryRenderedFeatures.mockReturnValue([{ properties: { id: 'point-1' } }]);

    click(ctx, state, 7.75, 46.0);

    expect(state.selectedPointId).toBe('point-1');
    expect(state.coordinates).toEqual([]);
    expect(ctx.updateUIClasses).toHaveBeenCalledWith({ mouse: 'move' });
    expect(ctx.map.fire).not.toHaveBeenCalled();
    expect(ctx.activateUIButton).not.toHaveBeenCalledWith('custom_route');
  });

  it('fires a complete event on stop only when points exist', () => {
    const emptyCtx = makeContext();
    stop(emptyCtx, setup(emptyCtx));
    expect(emptyCtx.map.fire).not.toHaveBeenCalled();

    const ctx = makeContext();
    const state = setup(ctx);
    click(ctx, state, 7.75, 46.0);

    stop(ctx, state);

    expect(ctx.map.fire).toHaveBeenCalledWith('draw.custom_route.complete', {
      coordinates: [[7.75, 46.0]],
    });
    expect(ctx.updateUIClasses).toHaveBeenCalledWith({ mouse: 'none' });
    expect(ctx.activateUIButton).toHaveBeenCalledWith();
  });
});
