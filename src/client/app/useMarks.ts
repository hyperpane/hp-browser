// Bookmarks as the window uses them: the star for the page, opening one (here,
// or ⌘-click in a new window), a bookmark's own menu, and the bar's menu.
// The list itself is this computer's, for every Browser (`lib/store.ts`).

import type { Host } from '@hyperpane/sdk/client';
import type { useMenu } from '@hyperpane/ui';
import { hostOf } from '../lib/address.ts';
import { type Bookmark, bookmarks, sameUrl, useBookmarks } from '../lib/store.ts';
import type { BookmarkActions } from '../views/Bookmarks.tsx';
import { at, bookmarkMenu, bookmarksMenu } from './menus.ts';
import type { Page } from './usePage.ts';

export function useMarks(host: Host, page: Page, o: { menu: ReturnType<typeof useMenu>; bar: boolean; setBar(on: boolean): void }) {
  const list = useBookmarks();
  const { url, title, copy } = page;
  const current = bookmarks.find(url);

  const toggle = () => {
    if (!url) return;
    if (current) bookmarks.remove(url);
    else bookmarks.add(url, title || hostOf(url) || url);
  };

  const rename = async (b: Bookmark) => {
    const name = await host.ui.prompt({ title: 'Rename Bookmark', label: 'Name', value: b.title });
    if (name !== null) bookmarks.rename(b.url, name);
  };

  const actions: BookmarkActions = {
    open: (b, fresh) => (fresh ? page.newWindow(b.url) : sameUrl(b.url, page.current.current) ? page.reload() : page.open(b.url)),
    menu: (b, where) => {
      const i = list.findIndex((m) => m.url === b.url);
      o.menu.open(
        at(where),
        bookmarkMenu({
          bookmark: b,
          first: i <= 0,
          last: i === list.length - 1,
          open: (fresh) => actions.open(b, fresh),
          rename: () => void rename(b),
          copy: () => copy(b.url),
          move: (by) => bookmarks.move(b.url, by),
          remove: () => bookmarks.remove(b.url),
        }),
      );
    },
  };

  const menu = () =>
    bookmarksMenu({
      list,
      current,
      url,
      bar: o.bar,
      open: (b) => actions.open(b, false),
      toggle,
      rename: (b) => void rename(b),
      setBar: o.setBar,
    });

  return { list, current, toggle, actions, menu };
}
