// The sizes a page shows at: the window's own (Responsive), a device's
// viewport in CSS pixels with the user agent its browser sends (so sites
// give their mobile pages), or a size of your own. Kept in the window's
// data: `device` (an id, or `custom` with `size` as `1280x800`) and
// `landscape` ('1').

export type DeviceKind = 'phone' | 'tablet' | 'computer';

export interface Device {
  id: string;
  name: string;
  kind: DeviceKind;
  /** Portrait for phones and tablets. */
  width: number;
  height: number;
  userAgent?: string;
}

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const PIXEL = 'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';
const GALAXY = 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';

/** In menu order, by kind (the same ids as plugin.json's `device`). */
export const DEVICES: Device[] = [
  { id: 'iphone-se', name: 'iPhone SE', kind: 'phone', width: 375, height: 667, userAgent: IPHONE },
  { id: 'iphone-15', name: 'iPhone 15', kind: 'phone', width: 390, height: 844, userAgent: IPHONE },
  { id: 'iphone-16-pro-max', name: 'iPhone 16 Pro Max', kind: 'phone', width: 440, height: 956, userAgent: IPHONE },
  { id: 'pixel-7', name: 'Pixel 7', kind: 'phone', width: 412, height: 915, userAgent: PIXEL },
  { id: 'galaxy-s24', name: 'Galaxy S24', kind: 'phone', width: 360, height: 780, userAgent: GALAXY },
  { id: 'ipad-mini', name: 'iPad mini', kind: 'tablet', width: 744, height: 1133, userAgent: IPAD },
  { id: 'ipad', name: 'iPad', kind: 'tablet', width: 820, height: 1180, userAgent: IPAD },
  { id: 'laptop', name: 'Laptop', kind: 'computer', width: 1280, height: 800 },
  { id: 'desktop', name: 'Desktop', kind: 'computer', width: 1440, height: 900 },
  { id: 'full-hd', name: 'Full HD', kind: 'computer', width: 1920, height: 1080 },
];

export const CUSTOM = 'custom';
export const MIN_SIZE = 200;
export const MAX_SIZE = 7680;

export function deviceById(id: string | undefined): Device | null {
  return DEVICES.find((d) => d.id === id) ?? null;
}

/** `1280x800`, `1280 × 800`, `1280, 800` as a size, within limits. */
export function parseSize(text: string): { width: number; height: number } | null {
  const m = /^\s*(\d{2,5})\s*(?:[x×*,]|\s)\s*(\d{2,5})\s*$/i.exec(text);
  if (!m) return null;
  const clamp = (n: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, n));
  return { width: clamp(Number(m[1])), height: clamp(Number(m[2])) };
}

/** What the window's data says the page is shown as: a name, its size as
 * shown (turned for landscape), its user agent, and whether it can turn;
 * null for Responsive. */
export function viewport(data: Record<string, string>): { name: string; width: number; height: number; userAgent: string | null; kind: DeviceKind } | null {
  const landscape = data.landscape === '1';
  const turn = (w: number, h: number) => (landscape ? { width: h, height: w } : { width: w, height: h });
  if (data.device === CUSTOM) {
    const size = parseSize(data.size ?? '');
    if (!size) return null;
    return { name: 'Custom', ...turn(size.width, size.height), userAgent: null, kind: size.width < size.height ? 'phone' : 'computer' };
  }
  const d = deviceById(data.device);
  if (!d) return null;
  return { name: d.name, ...turn(d.width, d.height), userAgent: d.userAgent ?? null, kind: d.kind };
}
