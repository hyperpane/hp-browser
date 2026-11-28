// Bookmarks as the Browser shows them: a bar under the address bar, and
// tiles on a blank page. A click opens one here; ⌘- or Ctrl-click in a new
// window; a right-click has the rest (rename, move, remove).

import { Globe } from '@hyperpane/icons';
import { Empty } from '@hyperpane/ui';
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
    <div className="scrollbar-none flex h-9 flex-none items-center gap-1 overflow-x-auto px-2 pb-1.5 touch:h-11" aria-label="Bookmarks bar">
      {list.map((b) => (
        <button
          key={b.url}
          type="button"
          title={`${b.title}\n${b.url}`}
          {...handlers(b, actions)}
          className={cn(
            'flex h-7 max-w-44 flex-none items-center gap-1.5 rounded-full px-2.5 text-[13px] text-[var(--node-muted)] transition-colors duration-100 hover:bg-[var(--node-hover)] hover:text-[var(--node-fg)] touch:h-10',
            styles.focusRing,
            b.url === current && 'bg-[var(--fill)] text-[var(--node-fg)]',
          )}
        >
          <Globe className="size-3.5 flex-none" variant="outline" />
          <span className="truncate">{b.title}</span>
        </button>
      ))}
    </div>
  );
}

/** A window with no page yet: what to type, and the bookmarks. */
export function Blank({ list, actions }: { list: Bookmark[]; actions: BookmarkActions }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-auto p-6 text-center text-[13px] text-[var(--node-muted)]">
      <Empty
        size="compact"
        icon={<Globe />}
        title="Go anywhere"
        description="Type an address above: a URL, localhost:5173, just a port (5173), a file’s path, or words to search."
      />
      {list.length > 0 && (
        <div className="grid w-full max-w-xl grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
          {list.map((b) => (
            <button
              key={b.url}
              type="button"
              title={b.url}
              {...handlers(b, actions)}
              className={cn(
                'rounded-card flex min-w-0 items-center gap-2.5 bg-[var(--surface-raised)] p-2.5 text-left transition-colors duration-100 hover:bg-[var(--node-hover)]',
                styles.focusRing,
              )}
            >
              <span className="grid size-7 flex-none place-items-center rounded-control bg-[var(--fill)] text-[var(--node-muted)]">
                <Globe className="size-4" variant="outline" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-[var(--node-fg)]">{b.title}</span>
                <span className="truncate text-xs">{hostOf(b.url) || b.url}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
