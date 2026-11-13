// The page in the window: where it is (or is going), the address bar's text,
// how its load is going, and what it says as it goes (`host.web`'s events).
// The page the window's data names is the one shown, so a change from anyone
// on the project goes there too; where the page goes on its own is kept back
// in the data a moment after it settles.

import { useEffect, useRef, useState } from 'react';
import type { Host, WebEvent } from '@hyperpane/sdk/client';
import type { useMenu } from '@hyperpane/ui';
import { display, failure, search, urlFor } from '../lib/address.ts';
import { history } from '../lib/store.ts';
import { at, pageMenu } from './menus.ts';

export type Page = ReturnType<typeof usePage>;

export function usePage(
  host: Host,
  o: {
    data: Record<string, string>;
    /** The page as the window's data names it ('' for none). */
    wanted: string;
    /** The device's user agent, or the Browser's own. */
    agent: string | null;
    engine: string;
    windows: boolean;
    menu: ReturnType<typeof useMenu>;
  },
) {
  const { agent, engine } = o;
  const [url, setUrl] = useState('');
  const [address, setAddress] = useState('');
  const [title, setPageTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [nav, setNav] = useState({ back: false, forward: false });
  const [error, setError] = useState<{ url: string; message: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const current = useRef('');
  const addressInput = useRef<HTMLInputElement>(null);
  const latest = useRef(o.data);
  latest.current = o.data;
  const keepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const copy = (text: string) => navigator.clipboard.writeText(text).catch((e: Error) => host.app.toast('Couldn’t copy.', { description: e.message, error: true }));

  const submit = () => {
    const to = urlFor(address, engine, o.windows);
    if (!to) return setAddress(display(current.current));
    addressInput.current?.blur();
    if (to === current.current && !error) host.web.reload();
    else open(to);
    // The page has the keys next, as in a browser.
    host.web.focus();
  };

  // The page the window's data names: from here, or anyone's on the project.
  useEffect(() => {
    if (o.wanted && o.wanted !== current.current) go(o.wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.wanted]);

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
        o.menu.open(
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

  /** The address bar's text as it's typed; the history to suggest from the
   * first key on. */
  const type = (text: string) => {
    setAddress(text);
    if (!suggestions.length) setSuggestions(history.list().slice(0, 50));
  };

  const revert = () => setAddress(display(current.current));

  return { url, address, title, loading, nav, error, suggestions, current, addressInput, open, newWindow, reload, focusAddress, copy, submit, type, revert };
}
