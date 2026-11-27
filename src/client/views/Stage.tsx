// What the frame draws on the stage around and instead of the page: a
// device's outline with its name and size above it (the app draws the page
// over the outline), and what went wrong when a page couldn't open.

import { RotateCw, TriangleAlert } from '@hyperpane/icons';
import { Button, IconTile } from '@hyperpane/ui';
import { display, hostOf } from '../lib/address.ts';
import { LABEL, type Viewport } from '../app/useStage.ts';

export function DeviceFrame({
  view,
  shown,
  scale,
}: {
  view: Viewport;
  shown: { left: number; top: number; width: number; height: number };
  scale: number | undefined;
}) {
  return (
    <>
      <div
        className="pointer-events-none absolute right-0 left-0 truncate text-center text-xs text-[var(--node-muted)] tabular-nums"
        style={{ top: shown.top - LABEL + 2 }}
      >
        {view.name} · {view.width} × {view.height}
        {scale !== 1 ? ` · ${Math.round(scale! * 100)}%` : ''}
      </div>
      <div className="rounded-chip pointer-events-none absolute bg-white ring-1 ring-[var(--node-border)]" style={shown} />
    </>
  );
}

/** What went wrong: an amber tile, the words, Try again. */
export function PageError({ error, onRetry }: { error: { url: string; message: string }; onRetry(): void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-auto bg-[var(--node-bg)] p-6 text-center">
      <IconTile icon={<TriangleAlert />} tint="var(--amber-soft-foreground)" />
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-[13px] font-medium">Couldn’t open {hostOf(error.url) || display(error.url)}</p>
        <p className="text-xs leading-relaxed text-[var(--node-muted)] [overflow-wrap:anywhere]">{error.message}</p>
      </div>
      <Button size="sm" variant="secondary" className="mt-1" onClick={onRetry}>
        <RotateCw className="size-3.5" />
        Try again
      </Button>
    </div>
  );
}
