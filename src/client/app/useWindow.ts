// The Browser's window on the canvas, apart from its page: what a new one
// starts with (the home page and the device from the settings), its title
// until the page says one, and its header's menu.

import { useEffect, useRef } from 'react';
import type { Host } from '@hyperpane/sdk/client';
import { keys } from '@hyperpane/sdk/client';
import { display, hostOf, urlFor } from '../lib/address.ts';
import { deviceById } from '../lib/devices.ts';
import type { Page } from './usePage.ts';

/** A new window: the home page and the device from the settings. */
export function useNewWindow(host: Host, data: Record<string, string>, engine: string, windows: boolean) {
  useEffect(() => {
    const d = data;
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
}

/** The window's title and its own menu (its header's). */
export function useWindowMenu(host: Host, page: Page) {
  const { url, title, nav, reload } = page;

  // A host name until the page says its title.
  useEffect(() => {
    if (!title && url) host.win.setTitle(hostOf(url) || display(url));
  }, [url, title, host]);

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
}
