// What the frame draws on the stage around and instead of the page: a
// device's outline with its name and size above it (the app draws the page
// over the outline), and what went wrong when a page couldn't open.

import { TriangleAlert } from 'lucide-react';
import { NodeButton } from '@hyperpane/ui';
import { display, hostOf } from '../lib/address.ts';
import { LABEL, type Viewport } from '../app/useStage.ts';

export function DeviceFrame({ view, shown, scale }: { view: Viewport; shown: { left: number; top: number; width: number; height: number }; scale: number | undefined }) {
  return (
    <>
      <div className="pointer-events-none absolute right-0 left-0 truncate text-center text-[10px] text-[var(--node-muted)] tabular-nums" style={{ top: shown.top - LABEL + 2 }}>
        {view.name} · {view.width} × {view.height}
        {scale !== 1 ? ` · ${Math.round(scale! * 100)}%` : ''}
      </div>
      <div className="rounded-chip pointer-events-none absolute bg-white shadow-lg ring-1 ring-[var(--node-border)]" style={shown} />
    </>
  );
}

export function PageError({ error, onRetry }: { error: { url: string; message: string }; onRetry(): void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
      <TriangleAlert className="size-6 text-[var(--ansi-3)]" />
      <p className="font-medium">Couldn’t open {hostOf(error.url) || display(error.url)}</p>
      <p className="max-w-sm text-[var(--node-muted)]">{error.message}</p>
      <NodeButton className="mt-1" onClick={onRetry}>
        Try Again
      </NodeButton>
    </div>
  );
}
