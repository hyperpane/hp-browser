// Bookmarks as the Browser shows them: a bar under the address bar, and
// tiles on a blank page. A click opens one here; ⌘- or Ctrl-click in a new
// window; a right-click has the rest (rename, move, remove).

import { Globe } from 'lucide-react';
import { mod } from '@hyperpane/sdk/client';
import { cn, styles } from '@hyperpane/ui';
import { hostOf } from '../lib/address.ts';
import type { Bookmark } from '../lib/store.ts';

export interface BookmarkActions {
  open(b: Bookmark, newWindow: boolean): void;
  menu(b: Bookmark, at: { x: number; y: number }): void;
}

function handlers(b: Bookmark, actions: BookmarkActions) {
  return {
    onClick: (e: React.MouseEvent) => actions.open(b, mod(e)),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      actions.menu(b, { x: e.clientX, y: e.clientY });
    },
  };
}

export function BookmarksBar({ list, current, actions }: { list: Bookmark[]; current: string; actions: BookmarkActions }) {
  return (
    <div className="flex h-7 flex-none items-center gap-0.5 overflow-hidden px-1.5 pb-1" aria-label="Bookmarks bar">
      {list.map((b) => (
        <button
          key={b.url}
          type="button"
          title={`${b.title}\n${b.url}`}
          {...handlers(b, actions)}
          className={cn(
            'rounded-control flex h-6 max-w-44 flex-none items-center gap-1.5 px-2 text-[var(--node-muted)] transition-colors duration-100 hover:bg-[var(--node-hover,var(--node-header))] hover:text-[var(--node-fg)]',
            styles.focusRing,
            b.url === current && 'text-[var(--node-fg)]',
          )}
        >
          <Globe className="size-3 flex-none" />
          <span className="truncate">{b.title}</span>
        </button>
      ))}
    </div>
  );
}

/** A window with no page yet: what to type, and the bookmarks. */
export function Blank({ list, actions }: { list: Bookmark[]; actions: BookmarkActions }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-auto p-6 text-center text-[var(--node-muted)]">
      <Globe className="size-6" />
      <p className="max-w-sm">Type an address above: a URL, localhost:5173, just a port (5173), a file’s path, or words to search.</p>
      {list.length > 0 && (
        <div className="flex w-full max-w-xl flex-wrap justify-center gap-2">
          {list.map((b) => (
            <button
              key={b.url}
              type="button"
              title={b.url}
              {...handlers(b, actions)}
              className={cn(
                'rounded-surface flex w-40 min-w-0 flex-col items-start gap-0.5 border border-[var(--node-border)] px-3 py-2 text-left transition-colors duration-100 hover:bg-[var(--node-hover,var(--node-header))]',
                styles.focusRing,
              )}
            >
              <span className="w-full truncate font-medium text-[var(--node-fg)]">{b.title}</span>
              <span className="w-full truncate">{hostOf(b.url) || b.url}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
