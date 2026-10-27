/**
 * Sprite sheet management for the fallback map: load the Martin
 * `accommodation,availability` pack, tint icons white for canvas
 * shields, and build CSS background-position spans for cluster icons.
 *
 * The sheet is fetched ONCE as a blob → Image, decoded, then:
 * - Canvas shields use `whiteIconFor(identifier)` — a cached offscreen
 *   canvas with the mono icon tinted white via source-in compositing.
 * - Cluster icons use `spriteSpan(...)` — a CSS background-image span
 *   positioned into the sheet via the `--wd-fb-sheet` CSS var.
 */
/** Structural stand-ins for DOM types (the project ESLint env lacks
 *  the DOM interface names — these carry exactly the members used). */
export interface SheetImage {
  src: string;
  decode(): Promise<void>;
}
export interface IconBitmap {
  width: number;
  height: number;
}

export interface SpriteSheet {
  icons: Record<string, { x: number; y: number; width: number; height: number }>;
  sheetW: number;
  sheetH: number;
  sheetImg: SheetImage;
}

/** WHITE-tinted icon bitmaps for canvas shields, cached per type. */
const whiteIconCache = new Map<string, IconBitmap | null>();

let spriteSheet: SpriteSheet | null = null;
let spriteSheetUrl: string | undefined;
/** Load-generation guard: revokeSprite() (component unmount) bumps it so
 *  an in-flight load revokes its OWN blob instead of re-populating module
 *  state nobody will clean up (Opus review #3). */
let loadGeneration = 0;

/** Load the sprite sheet; returns true on success. The URL is kept for
 *  revocation on unmount. Callers should rebuild markers after this
 *  resolves (the fallback draws plain dots until the sheet is ready). */
export async function loadSprite(tileServer: string): Promise<boolean> {
  if (spriteSheet) return true;
  const gen = ++loadGeneration;
  try {
    const base = `${tileServer}/sprite/accommodation,availability`;
    const [meta, png] = await Promise.all([fetch(`${base}.json`), fetch(`${base}.png`)]);
    if (!meta.ok || !png.ok) return false;
    const icons = (await meta.json()) as Record<
      string,
      { x: number; y: number; width: number; height: number }
    >;
    let sheetW = 0;
    let sheetH = 0;
    for (const e of Object.values(icons)) {
      sheetW = Math.max(sheetW, e.x + e.width);
      sheetH = Math.max(sheetH, e.y + e.height);
    }
    const url = URL.createObjectURL(await png.blob());
    if (gen !== loadGeneration) {
      // Unmounted mid-load — nobody owns this blob anymore
      URL.revokeObjectURL(url);
      return false;
    }
    spriteSheetUrl = url;
    // SAFETY: createElement('img') returns HTMLImageElement at runtime;
    // the structural SheetImage type hides the DOM interface name from
    // the linter. Only .src and .decode() are used.
    const sheetImg = document.createElement('img') as unknown as SheetImage;
    sheetImg.src = url;
    await sheetImg.decode().catch(() => undefined);
    if (gen !== loadGeneration) {
      URL.revokeObjectURL(url);
      return false;
    }
    spriteSheet = { icons, sheetW, sheetH, sheetImg };
    whiteIconCache.clear();
    return true;
  } catch {
    return false;
  }
}

/** Revoke the blob URL (call on component unmount). */
export function revokeSprite(): void {
  loadGeneration++; // invalidate any in-flight load
  if (spriteSheetUrl) URL.revokeObjectURL(spriteSheetUrl);
  spriteSheetUrl = undefined;
  spriteSheet = null;
  whiteIconCache.clear();
}

/** The loaded sheet (null before loadSprite succeeds). */
export function getSprite(): SpriteSheet | null {
  return spriteSheet;
}

/** The blob URL for the CSS var (--wd-fb-sheet). */
export function getSpriteUrl(): string | undefined {
  return spriteSheetUrl;
}

/** Get (or create) a WHITE-tinted bitmap for the given type identifier.
 *  Returns null if the sprite isn't loaded or the icon is missing. */
export function whiteIconFor(identifier: string | undefined): IconBitmap | null {
  const sheet = spriteSheet;
  const key = identifier ?? 'accommodation.unknown';
  if (whiteIconCache.has(key)) return whiteIconCache.get(key) ?? null;
  let canvas: IconBitmap | null = null;
  const entry = sheet?.icons[`mono/${key}`] ?? sheet?.icons['mono/accommodation.unknown'];
  if (sheet && entry) {
    const el = document.createElement('canvas');
    el.width = entry.width;
    el.height = entry.height;
    canvas = el;
    const c2d = el.getContext('2d');
    if (c2d) {
      c2d.drawImage(
        // SAFETY: sheetImg is a real <img>; the structural type only hides
        // the DOM interface name. drawImage accepts it at runtime.
        sheet.sheetImg as unknown as Parameters<CanvasRenderingContext2D['drawImage']>[0],
        entry.x,
        entry.y,
        entry.width,
        entry.height,
        0,
        0,
        entry.width,
        entry.height
      );
      c2d.globalCompositeOperation = 'source-in';
      c2d.fillStyle = '#ffffff';
      c2d.fillRect(0, 0, entry.width, entry.height);
    }
  }
  whiteIconCache.set(key, canvas);
  return canvas;
}

/** Build a CSS background-position span for cluster icons (DOM path —
 *  the cluster bubbles use sprite cells via CSS, not canvas). Every icon
 *  is NORMALIZED to the same refPx box regardless of source size. */
export function spriteSpan(
  key: string,
  fallbackKey: string,
  className: string,
  cssVar: string,
  refPx: number
): string {
  const sheet = spriteSheet;
  if (!sheet) return '';
  const entry = sheet.icons[key] ?? sheet.icons[fallbackKey];
  if (!entry) return '';
  const k = refPx / entry.width;
  const pos = `background-position:calc(${-entry.x}px * var(${cssVar}) * ${k}) calc(${-entry.y}px * var(${cssVar}) * ${k});`;
  const size = `width:calc(${refPx}px * var(${cssVar}));height:calc(${refPx}px * var(${cssVar}));`;
  const bg = `background-size:calc(var(--wd-fb-sheet-w, 432px) * var(${cssVar}) * ${k}) calc(var(--wd-fb-sheet-h, 480px) * var(${cssVar}) * ${k});`;
  return `<span class="${className}" style="${pos}${size}${bg}"></span>`;
}
