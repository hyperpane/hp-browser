// The Browser's menus, drawn by the app (so they go over the page): the
// device sizes, bookmarks, the rest of the bar's, a bookmark's, and the
// page's own right-click menu.

import type { WebEvent } from '@hyperpane/sdk/client';
import { keys } from '@hyperpane/sdk/client';
import type { MenuEntry } from '@hyperpane/ui';
import { hostOf } from '../lib/address.ts';
import { CUSTOM, DEVICES, type Device } from '../lib/devices.ts';
import type { Bookmark } from '../lib/store.ts';
import type { Anchor } from '../views/Toolbar.tsx';

export type Entries = (MenuEntry | null)[];
/** The app's menus open at a pointer: a button's anchor stands in for one. */
type PointerLike = { clientX: number; clientY: number; preventDefault(): void; stopPropagation(): void };
export const at = (a: Anchor): PointerLike => ({ clientX: a.x, clientY: a.y, preventDefault() {}, stopPropagation() {} });
/** ⌘-click, or Ctrl+Click off a Mac. */
const CLICK = keys('⌘') === '⌘' ? '⌘-click' : `${keys('⌘')}+Click`;
const check = (on: boolean, label: string) => `${on ? '✓' : ' '} ${label}`;

export function deviceMenu(o: {
  device: string | undefined;
  size: string | undefined;
  landscape: boolean;
  set(device: string | null): void;
  custom(): void;
  rotate(): void;
}): Entries {
  const chosen = o.device === CUSTOM || DEVICES.some((d) => d.id === o.device) ? o.device : null;
  const item = (d: Device | null): MenuEntry => ({
    label: check((d?.id ?? null) === chosen, d ? d.name : 'Responsive'),
    shortcut: d ? `${d.width} × ${d.height}` : 'fills the window',
    run: () => o.set(d ? d.id : null),
  });
  const kind = (k: Device['kind']) => DEVICES.filter((d) => d.kind === k).map(item);
  const turnable = chosen !== null;
  return [
    item(null),
    null,
    ...kind('phone'),
    null,
    ...kind('tablet'),
    null,
    ...kind('computer'),
    null,
    { label: check(o.device === CUSTOM, 'Custom Size…'), shortcut: o.device === CUSTOM ? o.size?.replace('x', ' × ') : undefined, run: o.custom },
    { label: `${' '} ${o.landscape ? 'Turn to Portrait' : 'Turn to Landscape'}`, disabled: !turnable, run: o.rotate },
  ];
}

export function bookmarksMenu(o: {
  list: Bookmark[];
  current: Bookmark | undefined;
  url: string;
  bar: boolean;
  open(b: Bookmark): void;
  toggle(): void;
  rename(b: Bookmark): void;
  setBar(on: boolean): void;
}): Entries {
  const MAX = 40;
  return [
    ...(o.list.length
      ? o.list.slice(0, MAX).map((b) => ({ label: b.title.length > 60 ? `${b.title.slice(0, 59)}…` : b.title, shortcut: hostOf(b.url), run: () => o.open(b) }))
      : [{ label: 'No bookmarks yet', disabled: true, run() {} }]),
    null,
    { label: o.current ? 'Remove This Page’s Bookmark' : 'Bookmark This Page', shortcut: keys('⌘D'), disabled: !o.url, run: o.toggle },
    ...(o.current ? [{ label: 'Rename This Page’s Bookmark…', run: () => o.rename(o.current!) }] : []),
    { label: o.bar ? 'Hide the Bookmarks Bar' : 'Show the Bookmarks Bar', run: () => o.setBar(!o.bar) },
  ];
}

export function bookmarkMenu(o: {
  bookmark: Bookmark;
  first: boolean;
  last: boolean;
  open(newWindow: boolean): void;
  rename(): void;
  copy(): void;
  move(by: -1 | 1): void;
  remove(): void;
}): Entries {
  return [
    { label: 'Open', run: () => o.open(false) },
    { label: 'Open in New Window', shortcut: CLICK, run: () => o.open(true) },
    null,
    { label: 'Rename…', run: o.rename },
    { label: 'Copy Address', run: o.copy },
    { label: 'Move Left', disabled: o.first, run: () => o.move(-1) },
    { label: 'Move Right', disabled: o.last, run: () => o.move(1) },
    null,
    { label: 'Remove', danger: true, run: o.remove },
  ];
}

export function moreMenu(o: {
  url: string;
  bar: boolean;
  reloadHard(): void;
  openOutside(): void;
  copy(): void;
  setBar(on: boolean): void;
  devtools(): void;
}): Entries {
  return [
    { label: 'Reload Ignoring Cache', shortcut: keys('⇧⌘R'), disabled: !o.url, run: o.reloadHard },
    { label: 'Open in Default Browser', disabled: !o.url, run: o.openOutside },
    { label: 'Copy Address', disabled: !o.url, run: o.copy },
    null,
    { label: o.bar ? 'Hide the Bookmarks Bar' : 'Show the Bookmarks Bar', run: () => o.setBar(!o.bar) },
    null,
    { label: 'Developer Tools', shortcut: keys('⌥⌘I'), disabled: !o.url, run: o.devtools },
  ];
}

type PageMenu = Extract<WebEvent, { type: 'menu' }>;

/** A right-click in the page: what's under it first, then the page's. */
export function pageMenu(
  e: PageMenu,
  o: {
    newWindow(url: string): void;
    copy(text: string): void;
    search(text: string): void;
    edit(action: 'cut' | 'copy' | 'paste' | 'selectAll' | 'undo' | 'redo'): void;
    back(): void;
    forward(): void;
    reload(): void;
    inspect(): void;
  },
): Entries {
  const out: Entries = [];
  const group = (items: Entries) => {
    if (!items.length) return;
    if (out.length) out.push(null);
    out.push(...items);
  };
  if (e.link && /^(https?|file):/i.test(e.link)) {
    group([
      { label: 'Open Link in New Window', shortcut: CLICK, run: () => o.newWindow(e.link) },
      { label: 'Copy Link Address', run: () => o.copy(e.link) },
      ...(e.linkText.trim() ? [{ label: 'Copy Link Text', run: () => o.copy(e.linkText.trim()) }] : []),
    ]);
  }
  if (e.media === 'image' && e.src && /^(https?|file):/i.test(e.src)) {
    group([
      { label: 'Open Image in New Window', run: () => o.newWindow(e.src) },
      { label: 'Copy Image Address', run: () => o.copy(e.src) },
    ]);
  }
  if (e.editable) {
    group([
      { label: 'Undo', shortcut: keys('⌘Z'), run: () => o.edit('undo') },
      { label: 'Redo', shortcut: keys('⇧⌘Z'), run: () => o.edit('redo') },
      null,
      { label: 'Cut', shortcut: keys('⌘X'), disabled: !e.selection, run: () => o.edit('cut') },
      { label: 'Copy', shortcut: keys('⌘C'), disabled: !e.selection, run: () => o.edit('copy') },
      { label: 'Paste', shortcut: keys('⌘V'), run: () => o.edit('paste') },
      { label: 'Select All', shortcut: keys('⌘A'), run: () => o.edit('selectAll') },
    ]);
  } else if (e.selection.trim()) {
    const text = e.selection.trim().replace(/\s+/g, ' ');
    group([
      { label: 'Copy', shortcut: keys('⌘C'), run: () => o.edit('copy') },
      { label: `Search for “${text.length > 30 ? `${text.slice(0, 29)}…` : text}”`, run: () => o.search(text) },
    ]);
  }
  group([
    { label: 'Back', shortcut: keys('⌘['), disabled: !e.back, run: o.back },
    { label: 'Forward', shortcut: keys('⌘]'), disabled: !e.forward, run: o.forward },
    { label: 'Reload', shortcut: keys('⌘R'), run: o.reload },
  ]);
  group([{ label: 'Inspect Element', shortcut: keys('⌥⌘I'), run: o.inspect }]);
  return out;
}
