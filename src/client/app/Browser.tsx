// A Browser window: one real page (the app's Chromium view, `host.web`),
// one window, no tabs. A link that wants a new window (⌘- or Ctrl-click,
// target=_blank, window.open) opens another Browser on the canvas. The page
// is in the window's data (`url`), so everyone on the project sees the same
// one; so are the device it's shown as (`device`, `size`, `landscape`).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { Host, WebEvent, WebRect } from '@hyperpane/sdk/client';
import { keys, mod, shortcutKey, useData, useServers, useSetting } from '@hyperpane/sdk/client';
import { NodeButton, NodeMessage, cn, useMenu, type MenuEntry } from '@hyperpane/ui';
import { display, failure, fileUrl, hostOf, search, searchUrl, urlFor } from '../lib/address.ts';
import { CUSTOM, deviceById, parseSize, viewport } from '../lib/devices.ts';
import { type Bookmark, bookmarks, history, sameUrl, useBookmarks } from '../lib/store.ts';
import { Blank, type BookmarkActions, BookmarksBar } from '../views/Bookmarks.tsx';
import { type Anchor, Progress, Toolbar } from '../views/Toolbar.tsx';
import { bookmarkMenu, bookmarksMenu, deviceMenu, moreMenu, pageMenu } from './menus.ts';
import { useProgress } from './useProgress.ts';

/** Room around a device's page, and for its name above it. */
const PAD = 16;
const LABEL = 18;

type PointerLike = { clientX: number; clientY: number; preventDefault(): void; stopPropagation(): void };
const at = (a: Anchor): PointerLike => ({ clientX: a.x, clientY: a.y, preventDefault() {}, stopPropagation() {} });

export function Browser({ host }: { host: Host }) {
  const data = useData();
  const servers = useServers();
  const [engineId] = useSetting<string>('searchEngine');
  const [customSearch] = useSetting<string>('searchUrl');
  const [barSetting, setBarSetting] = useSetting<boolean>('bookmarksBar');
  const engine = searchUrl(engineId, customSearch);
  const windows = host.init.platform.os === 'windows';
  const marks = useBookmarks();
  const menu = useMenu();

  /** Where the page is (or is going). */
  const [url, setUrl] = useState('');
  const [address, setAddress] = useState('');
  const [title, setPageTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [nav, setNav] = useState({ back: false, forward: false });
  const [error, setError] = useState<{ url: string; message: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const progress = useProgress(loading);
  const current = useRef('');
  const addressInput = useRef<HTMLInputElement>(null);
  const latest = useRef(data);
  latest.current = data;
  const keepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const view = viewport(data);
  const agent = view?.userAgent ?? null;
  // A file opened with the Browser is a path on the window's server: a
  // page here only when that's this computer.
  const serverId = host.window?.server ?? host.project?.server;
  const local = servers.find((s) => s.id === serverId)?.local ?? true;
  const wanted = data.url || (data.path && local ? fileUrl(data.path) : '');
  const elsewhere = !data.url && !!data.path && !local;
  const currentMark = bookmarks.find(url);
  const bar = barSetting !== false && marks.length > 0;

  // Opening ---------------------------------------------------------------------

  const go = (to: string) => {
    setError(null);
    current.current = to;
    setUrl(to);
    setAddress(display(to));
    host.web.load(to, { userAgent: agent });
  };

  /** Opens it here, and keeps it in the window's data. */
  const open = (to: string) => {
    go(to);
    host.win.setData('url', to);
  };

  const newWindow = (to: string) => {
    host.app.newNode(host.init.plugin.id, '', { data: { url: to } }).catch((e: Error) => host.app.toast('Couldn’t open a new window.', { description: e.message, error: true }));
  };

  /** The page as it is now, in the window's data, a moment after it
   * settles (redirects, a page changing its address as it goes). */
  const keep = (to: string) => {
    if (keepTimer.current) clearTimeout(keepTimer.current);
    keepTimer.current = setTimeout(() => {
      if (to && to !== 'about:blank' && to !== latest.current.url) host.win.setData('url', to);
    }, 300);
  };

  const reload = (hard = false) => {
    if (error) {
      setError(null);
      host.web.load(error.url, { userAgent: agent });
    } else if (current.current) host.web.reload({ hard });
  };

  const focusAddress = () => {
    const input = addressInput.current;
    if (!input) return;
    input.focus();
    input.select();
  };

  const toggleMark = () => {
    if (!url) return;
    if (currentMark) bookmarks.remove(url);
    else bookmarks.add(url, title || hostOf(url) || url);
  };

  const renameMark = async (b: Bookmark) => {
    const name = await host.ui.prompt({ title: 'Rename Bookmark', label: 'Name', value: b.title });
    if (name !== null) bookmarks.rename(b.url, name);
  };

  const copy = (text: string) => navigator.clipboard.writeText(text).catch((e: Error) => host.app.toast('Couldn’t copy.', { description: e.message, error: true }));

  const submit = () => {
    const to = urlFor(address, engine, windows);
    if (!to) return setAddress(display(current.current));
    addressInput.current?.blur();
    if (to === current.current && !error) host.web.reload();
    else open(to);
    // The page has the keys next, as in a browser.
    host.web.focus();
  };

  // A new window: the home page and the device from the settings ---------------

  useEffect(() => {
    const d = latest.current;
    if (d.new !== '1') return;
    host.win.setData('new', null);
    if (!d.url && !d.path) {
      const home = host.settings.get<string>('homePage')?.trim();
      const to = home ? urlFor(home, engine, windows) : null;
      if (to) host.win.setData('url', to);
    }
    if (!d.device) {
      const device = host.settings.get<string>('device');
      if (deviceById(device)) host.win.setData('device', device);
    }
    // Once, as the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The page the window's data names: from here, or anyone's on the project.
  useEffect(() => {
    if (wanted && wanted !== current.current) go(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  // A device's own user agent (the page loads again with it).
  useEffect(() => {
    if (current.current) host.web.setUserAgent(agent);
  }, [agent, host]);

  useEffect(() => () => void (keepTimer.current && clearTimeout(keepTimer.current)), []);

  // What happens in the page --------------------------------------------------

  const onWeb = (e: WebEvent) => {
    switch (e.type) {
      case 'loading':
        setLoading(e.loading);
        setNav({ back: e.back, forward: e.forward });
        break;
      case 'navigate':
        current.current = e.url;
        setUrl(e.url);
        setNav({ back: e.back, forward: e.forward });
        if (document.activeElement !== addressInput.current) setAddress(display(e.url));
        if (!e.inPage) setError(null);
        history.add(e.url);
        keep(e.url);
        break;
      case 'title':
        setPageTitle(e.title);
        if (e.title) host.win.setTitle(e.title);
        break;
      case 'fail':
        setError({ url: e.url, message: failure(e.code, e.description) });
        setLoading(false);
        break;
      case 'crash':
        if (e.reason !== 'clean-exit') setError({ url: current.current, message: 'The page crashed. Reload it to try again.' });
        break;
      case 'open':
        newWindow(e.url);
        break;
      case 'key':
        if (e.key === 'address') focusAddress();
        else if (e.key === 'back') host.web.back();
        else if (e.key === 'forward') host.web.forward();
        else if (e.key === 'devtools') host.web.devtools();
        break;
      case 'menu':
        menu.open(
          at(e),
          pageMenu(e, {
            newWindow,
            copy,
            search: (text) => newWindow(search(text, engine)),
            edit: (action) => host.web.edit(action),
            back: () => host.web.back(),
            forward: () => host.web.forward(),
            reload: () => reload(),
            inspect: () => host.web.devtools({ x: e.pageX, y: e.pageY }),
          }),
        );
        break;
    }
  };
  const onWebRef = useRef(onWeb);
  onWebRef.current = onWeb;
  useEffect(() => host.web.on((e) => onWebRef.current(e)), [host]);

  // A host name until the page says its title.
  useEffect(() => {
    if (!title && url) host.win.setTitle(hostOf(url) || display(url));
  }, [url, title, host]);

  // The window's own menu (its header's).
  const onMenuItem = useRef<(id: string) => void>(() => {});
  onMenuItem.current = (id) => {
    if (id === 'back') host.web.back();
    else if (id === 'forward') host.web.forward();
    else if (id === 'reload') reload();
    else if (id === 'devtools') host.web.devtools();
    else if (id === 'outside' && url) host.app.openExternal(url);
  };
  useEffect(() => host.on('menu', (v: { id: string }) => onMenuItem.current(v.id)), [host]);
  useEffect(() => {
    host.win.setMenu([
      { id: 'back', label: 'Back', shortcut: keys('⌘['), disabled: !nav.back },
      { id: 'forward', label: 'Forward', shortcut: keys('⌘]'), disabled: !nav.forward },
      { id: 'reload', label: 'Reload Page', disabled: !url },
      { id: 'devtools', label: 'Developer Tools', disabled: !url },
      { id: 'outside', label: 'Open in Default Browser', disabled: !/^https?:/i.test(url) },
    ]);
  }, [host, nav.back, nav.forward, url]);

  // Where the page goes ---------------------------------------------------------

  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
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

  const showPage = host.web.available && !!url && !error;
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

  // Keys in the frame (the page's come as `key` events) -------------------------

  const onKeyDown = (e: React.KeyboardEvent) => {
    let act: (() => void) | null = null;
    const k = shortcutKey(e);
    if (e.key === 'F12' && !e.altKey && !e.shiftKey && !mod(e)) act = () => host.web.devtools();
    else if (mod(e) && e.altKey && !e.shiftKey && k === 'i') act = () => host.web.devtools();
    else if (mod(e) && !e.altKey) {
      if (k === 'l' && !e.shiftKey) act = focusAddress;
      else if (k === 'r') act = () => reload(e.shiftKey);
      else if (k === '[' && !e.shiftKey) act = () => host.web.back();
      else if (k === ']' && !e.shiftKey) act = () => host.web.forward();
      else if (k === 'd' && !e.shiftKey) act = toggleMark;
    }
    if (!act) return;
    // ⌘R would reload the app: this window's page instead.
    e.preventDefault();
    e.stopPropagation();
    act();
  };

  // Menus ---------------------------------------------------------------------

  const setDevice = (device: string | null) => {
    host.win.setData('device', device);
    if (device !== CUSTOM) host.win.setData('size', null);
  };

  const customSize = async () => {
    const was = view ? `${view.width} × ${view.height}` : box ? `${Math.round(box.width)} × ${Math.round(box.height)}` : '1280 × 800';
    const text = await host.ui.prompt({ title: 'Custom Size', label: 'Width × height, in CSS pixels', value: was, placeholder: '1280 × 800' });
    if (text === null) return;
    const size = parseSize(text);
    if (!size) return host.app.toast('That isn’t a size.', { description: 'Type it as width × height: 1280 × 800.', error: true });
    host.win.setData('device', CUSTOM);
    host.win.setData('size', `${size.width}x${size.height}`);
    host.win.setData('landscape', null);
  };

  const rotate = () => host.win.setData('landscape', data.landscape === '1' ? null : '1');

  const markActions: BookmarkActions = {
    open: (b, fresh) => (fresh ? newWindow(b.url) : sameUrl(b.url, current.current) ? reload() : open(b.url)),
    menu: (b, where) => {
      const i = marks.findIndex((m) => m.url === b.url);
      menu.open(
        at(where),
        bookmarkMenu({
          bookmark: b,
          first: i <= 0,
          last: i === marks.length - 1,
          open: (fresh) => markActions.open(b, fresh),
          rename: () => void renameMark(b),
          copy: () => copy(b.url),
          move: (by) => bookmarks.move(b.url, by),
          remove: () => bookmarks.remove(b.url),
        }),
      );
    },
  };

  const entries = {
    device: (): (MenuEntry | null)[] =>
      deviceMenu({ device: data.device, size: data.size, landscape: data.landscape === '1', set: setDevice, custom: () => void customSize(), rotate }),
    bookmarks: () =>
      bookmarksMenu({
        list: marks,
        current: currentMark,
        url,
        bar: barSetting !== false,
        open: (b) => markActions.open(b, false),
        toggle: toggleMark,
        rename: (b) => void renameMark(b),
        setBar: (on) => setBarSetting(on),
      }),
    more: () =>
      moreMenu({
        url,
        bar: barSetting !== false,
        reloadHard: () => reload(true),
        openOutside: () => host.app.openExternal(url),
        copy: () => copy(url),
        setBar: (on) => setBarSetting(on),
        devtools: () => host.web.devtools(),
      }),
  };

  // ---------------------------------------------------------------------------

  if (!host.web.available) {
    return (
      <NodeMessage>
        {host.init.platform.desktop ? 'This Browser can’t show pages: it needs the webview permission in its plugin.json.' : 'The Browser shows pages in the desktop app.'}
      </NodeMessage>
    );
  }

  const shown = rect && view ? { left: rect.x - (box?.x ?? 0), top: rect.y - (box?.y ?? 0), width: view.width * (rect.scale ?? 1), height: view.height * (rect.scale ?? 1) } : null;

  return (
    <div className="flex h-full flex-col text-xs" onKeyDown={onKeyDown}>
      <Toolbar
        url={url}
        address={address}
        inputRef={addressInput}
        suggestions={suggestions}
        loading={loading}
        nav={nav}
        bookmarked={!!currentMark}
        device={view}
        landscape={data.landscape === '1'}
        onAddress={(text) => {
          setAddress(text);
          if (!suggestions.length) setSuggestions(history.list().slice(0, 50));
        }}
        onSubmit={submit}
        onRevert={() => setAddress(display(current.current))}
        onBack={() => host.web.back()}
        onForward={() => host.web.forward()}
        onReload={() => reload()}
        onStop={() => host.web.stop()}
        onMark={toggleMark}
        onDeviceMenu={(a) => menu.open(at(a), entries.device())}
        onRotate={rotate}
        onBookmarksMenu={(a) => menu.open(at(a), entries.bookmarks())}
        onDevtools={() => host.web.devtools()}
        onMore={(a) => menu.open(at(a), entries.more())}
      />
      <Progress value={progress} />
      {bar && <BookmarksBar list={marks} current={url} actions={markActions} />}

      <div ref={stage} className={cn('relative min-h-0 flex-1 overflow-hidden', view && 'bg-[var(--node-header)]')}>
        {/* The app draws the page over this, where `rect` says. */}
        {shown && view && (
          <>
            <div className="pointer-events-none absolute right-0 left-0 truncate text-center text-[10px] text-[var(--node-muted)] tabular-nums" style={{ top: shown.top - LABEL + 2 }}>
              {view.name} · {view.width} × {view.height}
              {rect!.scale !== 1 ? ` · ${Math.round(rect!.scale! * 100)}%` : ''}
            </div>
            <div className="rounded-chip pointer-events-none absolute bg-white shadow-lg ring-1 ring-[var(--node-border)]" style={shown} />
          </>
        )}

        {!url && !elsewhere && <Blank list={marks} actions={markActions} />}

        {elsewhere && (
          <NodeMessage>
            {data.path} is a file on {servers.find((s) => s.id === serverId)?.name ?? 'another server'}: the Browser shows pages from this computer.
          </NodeMessage>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <TriangleAlert className="size-6 text-[var(--ansi-3)]" />
            <p className="font-medium">Couldn’t open {hostOf(error.url) || display(error.url)}</p>
            <p className="max-w-sm text-[var(--node-muted)]">{error.message}</p>
            <NodeButton className="mt-1" onClick={() => reload()}>
              Try Again
            </NodeButton>
          </div>
        )}
      </div>
    </div>
  );
}
