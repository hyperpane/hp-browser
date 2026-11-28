// A Browser window: one real page (the app's Chromium view, `host.web`),
// one window, no tabs. A link that wants a new window (⌘- or Ctrl-click,
// target=_blank, window.open) opens another Browser on the canvas. The page
// is in the window's data (`url`), so everyone on the project sees the same
// one; so are the device it's shown as (`device`, `size`, `landscape`).
//
// This puts the window together: the page (`usePage`), where it goes on the
// stage (`useStage`), the device (`useDevice`), bookmarks (`useMarks`), the
// window's own title and menu (`useWindow`), the keys (`keys.ts`), and what
// it does for other plugins that drive it (`useApi`).

import type { Host } from '@hyperpane/sdk/client';
import { useBack, useData, useServers, useSetting } from '@hyperpane/sdk/client';
import { Empty, cn, useCompact, useMenu } from '@hyperpane/ui';
import { Globe, Server } from '@hyperpane/icons';
import { fileUrl, searchUrl } from '../lib/address.ts';
import { viewport } from '../lib/devices.ts';
import { Blank, BookmarksBar } from '../views/Bookmarks.tsx';
import { DeviceFrame, PageError } from '../views/Stage.tsx';
import { type Anchor, Progress, Toolbar } from '../views/Toolbar.tsx';
import { frameKeys } from './keys.ts';
import { at, moreMenu } from './menus.ts';
import { useDevice } from './useDevice.ts';
import { useMarks } from './useMarks.ts';
import { useApi } from './useApi.ts';
import { usePage } from './usePage.ts';
import { useProgress } from './useProgress.ts';
import { useStage } from './useStage.ts';
import { useNewWindow, useWindowMenu } from './useWindow.ts';
import { ACCENT } from '../lib/accent.ts';

export function Browser({ host }: { host: Host }) {
  const data = useData();
  const servers = useServers();
  const [engineId] = useSetting<string>('searchEngine');
  const [customSearch] = useSetting<string>('searchUrl');
  const [barSetting, setBarSetting] = useSetting<boolean>('bookmarksBar');
  const engine = searchUrl(engineId, customSearch);
  const windows = host.init.platform.os === 'windows';
  const menu = useMenu();
  const compact = useCompact();

  const view = viewport(data);
  // A file opened with the Browser is a path on the window's server: a
  // page here only when that's this computer.
  const serverId = host.window?.server ?? host.project?.server;
  const local = servers.find((s) => s.id === serverId)?.local ?? true;
  const wanted = data.url || (data.path && local ? fileUrl(data.path) : '');
  const elsewhere = !data.url && !!data.path && !local;

  useNewWindow(host, data, engine, windows);
  const page = usePage(host, { data, wanted, agent: view?.userAgent ?? null, engine, windows, menu });
  const { url, error } = page;
  const progress = useProgress(page.loading);
  useWindowMenu(host, page);
  // The header's back button and the toolbar's: the page's history, on
  // while it can go back.
  const back = () => host.web.back();
  useBack(page.nav.back ? back : null);
  useApi(host, page);
  const { stage, box, rect, shown } = useStage(host, view, host.web.available && !!url && !error);
  const device = useDevice(host, data, view, box);
  const marks = useMarks(host, page, { menu, bar: barSetting !== false, setBar: (on) => setBarSetting(on) });
  const bar = barSetting !== false && marks.list.length > 0;

  const onKeyDown = frameKeys(host, { focusAddress: page.focusAddress, reload: page.reload, toggleMark: marks.toggle });

  const more = (a: Anchor) =>
    moreMenu({
      url,
      bar: barSetting !== false,
      bookmarks: compact ? () => menu.open(at(a), marks.menu()) : undefined,
      reloadHard: () => page.reload(true),
      openOutside: () => host.app.openExternal(url),
      copy: () => page.copy(url),
      setBar: (on) => setBarSetting(on),
      devtools: () => host.web.devtools(),
    });

  if (!host.web.available) {
    return (
      <Empty
        size="compact"
        className="h-full"
        icon={<Globe />}
        title="No pages here"
        description={
          host.init.platform.desktop
            ? 'This Browser can’t show pages: it needs the webview permission in its plugin.json.'
            : 'The Browser shows pages in the desktop app.'
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col text-[13px] leading-5" onKeyDown={onKeyDown} style={ACCENT}>
      {/* The bars, one line under them all (the loading line over it). */}
      <div className="relative flex flex-none flex-col border-b border-[var(--hairline)]">
        <Toolbar
          url={url}
          address={page.address}
          inputRef={page.addressInput}
          suggestions={page.suggestions}
          loading={page.loading}
          nav={page.nav}
          bookmarked={!!marks.current}
          device={view}
          landscape={device.landscape}
          onAddress={page.type}
          onSubmit={page.submit}
          onRevert={page.revert}
          onBack={back}
          onForward={() => host.web.forward()}
          onReload={() => page.reload()}
          onStop={() => host.web.stop()}
          onMark={marks.toggle}
          onDeviceMenu={(a) => menu.open(at(a), device.menu())}
          onRotate={device.rotate}
          onBookmarksMenu={(a) => menu.open(at(a), marks.menu())}
          onDevtools={() => host.web.devtools()}
          onMore={(a) => menu.open(at(a), more(a))}
        />
        {bar && <BookmarksBar list={marks.list} current={url} actions={marks.actions} />}
        <Progress value={progress} />
      </div>

      <div ref={stage} className={cn('relative min-h-0 flex-1 overflow-hidden', view && 'bg-[var(--node-header)]')}>
        {/* The app draws the page over this, where `rect` says. */}
        {shown && view && <DeviceFrame view={view} shown={shown} scale={rect!.scale} />}

        {!url && !elsewhere && <Blank list={marks.list} actions={marks.actions} />}

        {elsewhere && (
          <Empty
            size="compact"
            className="h-full"
            icon={<Server />}
            title="On another server"
            description={`${data.path} is a file on ${servers.find((s) => s.id === serverId)?.name ?? 'another server'}: the Browser shows pages from this computer.`}
          />
        )}

        {error && <PageError error={error} onRetry={() => page.reload()} />}
      </div>
    </div>
  );
}
