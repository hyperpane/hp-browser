// Bookmarks and the addresses you've been to, kept on this computer in the
// plugin's own storage, so every Browser window has the same ones (and hears
// when another window changes them).

import { useSyncExternalStore } from 'react';

export interface Bookmark {
  url: string;
  title: string;
}

const BOOKMARKS = 'browser.bookmarks';
const HISTORY = 'browser.history';
const MAX_HISTORY = 200;

function read<T>(key: string, valid: (v: unknown) => v is T): T[] {
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(list) ? list.filter(valid) : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Full or refused: it stays as it was.
  }
}

const isBookmark = (v: unknown): v is Bookmark =>
  !!v && typeof v === 'object' && typeof (v as Bookmark).url === 'string' && typeof (v as Bookmark).title === 'string';
const isString = (v: unknown): v is string => typeof v === 'string';

const listeners = new Set<() => void>();
let cached: Bookmark[] | null = null;

function changed() {
  cached = null;
  for (const l of [...listeners]) l();
}

// Another Browser window (another frame of this plugin) changed them.
addEventListener('storage', (e) => {
  if (e.key === BOOKMARKS || e.key === null) changed();
});

function save(list: Bookmark[]) {
  write(BOOKMARKS, list);
  changed();
}

/** The same address, give or take a lone trailing slash. */
export const sameUrl = (a: string, b: string) => a.replace(/\/$/, '') === b.replace(/\/$/, '');

export const bookmarks = {
  list(): Bookmark[] {
    return (cached ??= read(BOOKMARKS, isBookmark));
  },
  find(url: string): Bookmark | undefined {
    return url ? this.list().find((b) => sameUrl(b.url, url)) : undefined;
  },
  add(url: string, title: string) {
    if (!url || this.find(url)) return;
    save([...this.list(), { url, title: title.trim() || url }]);
  },
  remove(url: string) {
    save(this.list().filter((b) => !sameUrl(b.url, url)));
  },
  rename(url: string, title: string) {
    save(this.list().map((b) => (sameUrl(b.url, url) ? { ...b, title: title.trim() || b.url } : b)));
  },
  /** Moves one by `by` places (−1 left, 1 right). */
  move(url: string, by: -1 | 1) {
    const list = [...this.list()];
    const at = list.findIndex((b) => sameUrl(b.url, url));
    const to = at + by;
    if (at < 0 || to < 0 || to >= list.length) return;
    [list[at], list[to]] = [list[to], list[at]];
    save(list);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};

export function useBookmarks(): Bookmark[] {
  return useSyncExternalStore(bookmarks.subscribe, () => bookmarks.list());
}

/** Addresses you've been to, the latest first: the address bar suggests
 * them. */
export const history = {
  list(): string[] {
    return read(HISTORY, isString);
  },
  add(url: string) {
    if (!/^(https?|file):/i.test(url)) return;
    write(HISTORY, [url, ...this.list().filter((u) => u !== url)].slice(0, MAX_HISTORY));
  },
};
