// Where the page goes in the frame. The app draws the page over the stage,
// where `host.web.place` says: the whole stage, or a device's size scaled to
// fit it with room around and its name above.

import { useLayoutEffect, useRef, useState } from 'react';
import type { Host, WebRect } from '@hyperpane/sdk/client';
import type { viewport } from '../lib/devices.ts';

/** Room around a device's page, and for its name above it. */
export const PAD = 16;
export const LABEL = 18;

export type Viewport = NonNullable<ReturnType<typeof viewport>>;
export type Box = { x: number; y: number; width: number; height: number };

export function useStage(host: Host, view: Viewport | null, showPage: boolean) {
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (b && b.x === r.left && b.y === r.top && b.width === r.width && b.height === r.height ? b : { x: r.left, y: r.top, width: r.width, height: r.height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      removeEventListener('resize', measure);
    };
  }, []);

  let rect: WebRect | null = null;
  if (showPage && box && box.width > 4 && box.height > 4) {
    if (!view) rect = { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 };
    else {
      const scale = Math.min(1, (box.width - PAD * 2) / view.width, (box.height - PAD * 2 - LABEL) / view.height);
      if (scale > 0.02) {
        const shown = view.width * scale;
        rect = { x: box.x + Math.max(PAD, (box.width - shown) / 2), y: box.y + PAD + LABEL, width: view.width, height: view.height, scale };
      }
    }
  }
  const placed = useRef('');
  useLayoutEffect(() => {
    const text = JSON.stringify(rect);
    if (text === placed.current) return;
    placed.current = text;
    host.web.place(rect);
  });

  /** A device's page as the stage shows it, for its outline under the page. */
  const shown = rect && view ? { left: rect.x - (box?.x ?? 0), top: rect.y - (box?.y ?? 0), width: view.width * (rect.scale ?? 1), height: view.height * (rect.scale ?? 1) } : null;

  return { stage, box, rect, shown };
}
