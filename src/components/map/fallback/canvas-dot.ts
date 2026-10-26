/**
 * WdCanvasDot — a custom Leaflet CircleMarker that draws a complete
 * hut marker in a single canvas path: availability disc + type-colored
 * shield + white sprite icon + optional status label.
 *
 * LOW-SPEC: one fill + one stroke + one drawImage per hut — no DOM
 * nodes at all. The class accesses Leaflet's private _renderer._ctx
 * and _point internals (documented, stable across Leaflet 1.x — see
 * the review's finding #7 for the Leaflet 2.x risk note).
 */
import * as L from 'leaflet';
import { DEFAULT_DOT_COLOR, SELECTION_COLOR, LABEL_COLOR, OCC_LABEL_FONT } from './status-colors';
import { whiteIconFor, type IconBitmap } from './sprite-sheet';

/** Structural stand-in for the canvas 2D context (the project ESLint
 *  env lacks the DOM interface names). */
export interface CanvasDotCtx {
  arc(x: number, y: number, r: number, a: number, b: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  beginPath(): void;
  closePath(): void;
  drawImage(img: IconBitmap, dx: number, dy: number, dw: number, dh: number): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string;
  font: string;
  globalAlpha: number;
  lineTo(x: number, y: number): void;
  lineWidth: number;
  moveTo(x: number, y: number): void;
  stroke(): void;
  strokeStyle: string;
  strokeText(text: string, x: number, y: number): void;
  textAlign: string;
}

interface CanvasDotInternals {
  _point?: L.Point;
  _radius?: number;
  _renderer?: { _ctx: CanvasDotCtx | null };
}

// Injected by the component at draw time (module-level for perf — no
// per-marker closure captures).
export let markerOpacity = 1;
export let shieldPx = 19;

export function setMarkerOpacity(v: number): void {
  markerOpacity = v;
}
export function setShieldPx(v: number): void {
  shieldPx = v;
}

export class WdCanvasDot extends L.CircleMarker {
  private internals(): CanvasDotInternals & WdCanvasDot {
    // SAFETY: Leaflet stores _point/_renderer as private; we cast
    // `this` to a structural type exposing them. Runtime shape is
    // guaranteed by the Leaflet CircleMarker inheritance.
    return this as unknown as CanvasDotInternals & WdCanvasDot;
  }

  /** Rounded-rect path helper (canvas roundRect is not everywhere). */
  private static shieldPath(
    ctx: CanvasDotCtx,
    cx: number,
    cy: number,
    w: number,
    h: number,
    r: number
  ): void {
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  _updatePath(): void {
    const self = this.internals();
    const ctx = self._renderer?._ctx;
    const point = self._point;
    if (!ctx || !point) return;
    const options = this.options as {
      ringColor?: string;
      identifier?: string;
      typeColor: string;
      occLabel?: string;
      selected?: boolean;
      hovered?: boolean;
      dotRadius: number;
      ringRadius: number;
      fillColor: string;
    };
    const baseSize = shieldPx;
    const discR = baseSize * 0.8;
    if (options.ringColor) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, discR, 0, Math.PI * 2);
      ctx.globalAlpha = 0.85 * markerOpacity;
      ctx.fillStyle = options.ringColor;
      ctx.fill();
      // Category-colored border (type identity)
      ctx.lineWidth = 2;
      ctx.strokeStyle = options.typeColor ?? options.ringColor;
      ctx.stroke();
      ctx.globalAlpha = markerOpacity;
    }
    const icon = whiteIconFor(options.identifier);
    if (icon) {
      const size = options.hovered ? baseSize * 1.15 : baseSize;
      WdCanvasDot.shieldPath(ctx, point.x, point.y, size, size, size * 0.22);
      ctx.fillStyle = options.typeColor;
      ctx.fill();
      ctx.lineWidth = options.selected ? 3 : 1.5;
      ctx.strokeStyle = options.selected ? SELECTION_COLOR : '#ffffff';
      ctx.stroke();
      const iconPx = size * 0.72;
      ctx.drawImage(icon, point.x - iconPx / 2, point.y - iconPx / 2, iconPx, iconPx);
      if (options.occLabel) {
        ctx.font = OCC_LABEL_FONT;
        ctx.textAlign = 'center';
        const labelY = point.y + discR + 11;
        ctx.globalAlpha = 0.95 * markerOpacity;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(options.occLabel, point.x, labelY);
        ctx.fillStyle = LABEL_COLOR;
        ctx.fillText(options.occLabel, point.x, labelY);
        ctx.globalAlpha = markerOpacity;
      }
    } else {
      // Pre-sprite fallback: plain colored dot
      ctx.beginPath();
      ctx.arc(point.x, point.y, options.dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = options.fillColor || DEFAULT_DOT_COLOR;
      ctx.fill();
      ctx.lineWidth = options.selected ? 3 : 2;
      ctx.strokeStyle = options.selected ? SELECTION_COLOR : '#ffffff';
      ctx.stroke();
    }
  }

  /** Finger-sized hit area regardless of the small visual shield. */
  _containsPoint(p: L.Point): boolean {
    const self = this.internals();
    return !!self._point && p.distanceTo(self._point) <= Math.max(self._radius ?? 0, 13);
  }
}
