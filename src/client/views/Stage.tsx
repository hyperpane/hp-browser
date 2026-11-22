// What the frame draws on the stage around and instead of the page: a
// device's outline with its name and size above it (the app draws the page
// over the outline), and what went wrong when a page couldn't open.

import { RotateCw, TriangleAlert } from 'lucide-react';
import { NodeButton } from '@hyperpane/ui';
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
        className="text-2xs pointer-events-none absolute right-0 left-0 truncate text-center text-[var(--node-muted)] tabular-nums"
        style={{ top: shown.top - LABEL + 2 }}
      >
        {view.name} · {view.width} × {view.height}
        {scale !== 1 ? ` · ${Math.round(scale! * 100)}%` : ''}
      </div>
      <div className="rounded-chip pointer-events-none absolute bg-white ring-1 ring-[var(--node-border)]" style={shown} />
    </>
  );
}

export function PageError({ error, onRetry }: { error: { url: string; message: string }; onRetry(): void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--node-bg)] p-6 text-center">
      <span className="rounded-surface grid size-10 place-items-center bg-[color-mix(in_srgb,var(--ansi-3)_12%,transparent)]">
        <TriangleAlert className="size-5 text-[var(--ansi-3)]" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Couldn’t open {hostOf(error.url) || display(error.url)}</p>
        <p className="max-w-sm text-[var(--node-muted)]">{error.message}</p>
      </div>
      <NodeButton className="mt-1" onClick={onRetry}>
        <RotateCw />
        Try again
      </NodeButton>
    </div>
  );
}
