// What a Browser window does for other plugins (its plugin.json's `api`,
// sdk/RPC.md §15): an AI plugin, say, opens one and drives it: goes to a
// page, reads it, lists what can be clicked or typed in, clicks, types,
// scrolls, runs a script, takes a picture, and hears where it goes. The
// page is read and driven through `host.web.run` (the `webview-control`
// permission), in a world of its own: the page's DOM, none of its scripts.

import { useEffect, useRef } from 'react';
import type { Host, WebEvent } from '@hyperpane/sdk/client';
import type { Page } from './usePage.ts';

/** How long a page may take to load before an answer goes without it. */
const LOAD_TIMEOUT = 30_000;
/** Text a `text` answer has at most, unless asked for less. */
const MAX_TEXT = 100_000;
/** Elements `elements` lists at most. */
const MAX_ELEMENTS = 500;

/** Where the page is, as callers hear it. */
interface PageState {
  url: string;
  title: string;
  loading: boolean;
  back: boolean;
  forward: boolean;
  error: string | null;
}

/** An element to act on: `elements` lists them; `click` and `type` take
 * its `id`, or a CSS selector, or (`click`) its text. */
interface Target {
  id?: number;
  selector?: string;
  text?: string;
}

const json = (v: unknown) => JSON.stringify(v);

/** The page-side helper each script starts with: finds a target. */
const FIND = `
const find = (t) => {
  if (t.id !== undefined && t.id !== null) {
    const el = document.querySelector('[data-hp-id="' + Number(t.id) + '"]');
    if (!el) throw new Error('There’s no element ' + t.id + ' on the page now: list them again');
    return el;
  }
  if (t.selector) {
    const el = document.querySelector(t.selector);
    if (!el) throw new Error('Nothing on the page matches ' + t.selector);
    return el;
  }
  if (t.text) {
    const want = String(t.text).trim().toLowerCase();
    const all = [...document.querySelectorAll('a, button, input[type=submit], input[type=button], [role=button], [role=link], [role=tab], [role=menuitem], summary, label')];
    const el = all.find((e) => (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().toLowerCase() === want)
      || all.find((e) => (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().toLowerCase().includes(want));
    if (!el) throw new Error('Nothing to click says “' + t.text + '”');
    return el;
  }
  throw new Error('Say which element: id, selector or text');
};
`;

/** Lists what can be clicked or typed in, numbering each (`data-hp-id`). */
const ELEMENTS = `
const seen = [];
let n = 0;
for (const el of document.querySelectorAll('a[href], button, input, textarea, select, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=textbox], [contenteditable=""], [contenteditable=true], [onclick]')) {
  const r = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || style.display === 'none') continue;
  if (el.type === 'hidden') continue;
  if (seen.length >= ${MAX_ELEMENTS}) break;
  n++;
  el.setAttribute('data-hp-id', String(n));
  const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || '').trim().replace(/\\s+/g, ' ').slice(0, 120);
  seen.push({
    id: n,
    tag: el.tagName.toLowerCase(),
    ...(el.getAttribute('role') ? { role: el.getAttribute('role') } : {}),
    ...(el.type && el.tagName !== 'BUTTON' ? { type: el.type } : {}),
    ...(text ? { text } : {}),
    ...(el.name ? { name: el.name } : {}),
    ...(el.placeholder ? { placeholder: el.placeholder } : {}),
    ...(el.href ? { href: el.href } : {}),
    ...(el.disabled ? { disabled: true } : {}),
    inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
  });
}
return seen;
`;

export function useApi(host: Host, page: Page) {
  const state = useRef<PageState>({ url: '', title: '', loading: false, back: false, forward: false, error: null });
  state.current = { ...state.current, url: page.url, title: page.title, loading: page.loading, ...page.nav, error: page.error?.message ?? null };
  const pageRef = useRef(page);
  pageRef.current = page;
  /** Waiting for the page to settle, and those following it (`watch`). */
  const settled = useRef(new Set<() => void>());
  const watchers = useRef(new Set<(e: WebEvent) => void>());

  useEffect(
    () =>
      host.web.on((e) => {
        // Where it is as the page says it, before React's next render.
        const now = state.current;
        if (e.type === 'loading') state.current = { ...now, loading: e.loading, back: e.back, forward: e.forward };
        else if (e.type === 'navigate') state.current = { ...now, url: e.url, back: e.back, forward: e.forward, error: e.inPage ? now.error : null };
        else if (e.type === 'title') state.current = { ...now, title: e.title };
        if (e.type === 'loading' && !e.loading) for (const done of [...settled.current]) done();
        if (e.type === 'fail' || e.type === 'crash') for (const done of [...settled.current]) done();
        for (const w of watchers.current) w(e);
      }),
    [host],
  );

  useEffect(() => {
    if (!host.web.available) return;
    const now = (): PageState => ({ ...state.current });

    /** Waits for the page to finish loading (a load starting within a
     * moment counts), at most LOAD_TIMEOUT. */
    const load = (start: () => void, signal: AbortSignal) =>
      new Promise<PageState>((resolve, reject) => {
        let begun = false;
        const finish = () => {
          clearTimeout(quiet);
          clearTimeout(limit);
          settled.current.delete(done);
          stop();
          resolve(now());
        };
        const done = () => begun && finish();
        settled.current.add(done);
        const stop = host.web.on((e) => {
          if (e.type === 'loading' && e.loading) begun = true;
        });
        // No load started (the same page, an in-page link): answer now.
        const quiet = setTimeout(() => !begun && finish(), 1500);
        const limit = setTimeout(finish, LOAD_TIMEOUT);
        signal.addEventListener('abort', finish);
        try {
          start();
        } catch (e) {
          finish();
          reject(e);
        }
      });

    const run = <T>(script: string) => host.web.run<T>(script);
    /** Runs a script that may send the page somewhere (a click, a form sent),
     * then waits for it to settle: what the script answered, and where the
     * page is. A script that fails fails the call. */
    const act = async <T>(script: string, signal: AbortSignal): Promise<{ out: T | null; after: PageState }> => {
      let out: T | null = null;
      let failed: unknown = null;
      const after = await load(() => {
        run<T>(script).then(
          (v) => {
            out = v;
          },
          (e) => {
            failed = e;
          },
        );
      }, signal);
      if (failed) throw failed;
      return { out, after };
    };
    const offs = [
      host.serve('open', (a: { url?: string }, { signal }) => {
        if (!a?.url || typeof a.url !== 'string') throw new Error('Say which page: an address, or words to search for');
        return load(() => {
          if (!pageRef.current.enter(a.url!)) throw new Error('That isn’t an address or a search');
        }, signal);
      }),
      host.serve('state', () => now()),
      host.serve('back', (_a, { signal }) => load(() => host.web.back(), signal)),
      host.serve('forward', (_a, { signal }) => load(() => host.web.forward(), signal)),
      host.serve('reload', (_a, { signal }) => load(() => pageRef.current.reload(), signal)),
      host.serve('waitForLoad', (_a, { signal }) => (state.current.loading ? load(() => {}, signal) : now())),
      host.serve('text', (a: { selector?: string; max?: number }) => {
        const max = Math.max(1, Math.min(MAX_TEXT, Number(a?.max) || MAX_TEXT));
        return run<{ text: string; truncated: boolean; url: string; title: string }>(`
          const root = ${json(a?.selector ?? null)} ? document.querySelector(${json(a?.selector ?? '')}) : document.body;
          if (!root) throw new Error('Nothing on the page matches ' + ${json(a?.selector ?? '')});
          const all = (root.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim();
          return { text: all.slice(0, ${max}), truncated: all.length > ${max}, url: location.href, title: document.title };
        `);
      }),
      host.serve('html', (a: { selector?: string; max?: number }) => {
        const max = Math.max(1, Math.min(MAX_TEXT * 5, Number(a?.max) || MAX_TEXT * 5));
        return run<{ html: string; truncated: boolean }>(`
          const root = ${json(a?.selector ?? null)} ? document.querySelector(${json(a?.selector ?? '')}) : document.documentElement;
          if (!root) throw new Error('Nothing on the page matches ' + ${json(a?.selector ?? '')});
          const all = root.outerHTML;
          return { html: all.slice(0, ${max}), truncated: all.length > ${max} };
        `);
      }),
      host.serve('elements', () => run(ELEMENTS)),
      host.serve('click', async (a: Target, { signal }) => {
        const { out, after } = await act<string>(
          `${FIND}
            const el = find(${json(a ?? {})});
            el.scrollIntoView({ block: 'center', inline: 'center' });
            el.focus?.();
            el.click();
            return (el.innerText || el.value || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 80);
          `,
          signal,
        );
        return { clicked: out, ...after };
      }),
      host.serve('type', async (a: Target & { value?: string; submit?: boolean; clear?: boolean }, { signal }) => {
        if (typeof a?.value !== 'string') throw new Error('Say what to type: value');
        const script = `${FIND}
            const el = find(${json(a)});
            el.scrollIntoView({ block: 'center' });
            el.focus();
            const value = ${json(a.value)};
            if (el.isContentEditable) {
              if (${a.clear !== false}) el.textContent = '';
              document.execCommand('insertText', false, value);
            } else {
              const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
              const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
              set.call(el, ${a.clear !== false} ? value : (el.value || '') + value);
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (${!!a.submit}) {
              const keys = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
              const go = el.dispatchEvent(new KeyboardEvent('keydown', keys));
              el.dispatchEvent(new KeyboardEvent('keyup', keys));
              if (go && el.form) el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit();
            }
            return null;
          `;
        if (!a.submit) {
          await run(script);
          return now();
        }
        return (await act(script, signal)).after;
      }),
      host.serve('scroll', (a: { by?: number; to?: 'top' | 'bottom'; selector?: string }) =>
        run<{ y: number; height: number }>(`
          if (${json(a?.selector ?? null)}) {
            const el = document.querySelector(${json(a?.selector ?? '')});
            if (!el) throw new Error('Nothing on the page matches ' + ${json(a?.selector ?? '')});
            el.scrollIntoView({ block: 'center' });
          } else if (${json(a?.to ?? null)} === 'top') scrollTo(0, 0);
          else if (${json(a?.to ?? null)} === 'bottom') scrollTo(0, document.documentElement.scrollHeight);
          else scrollBy(0, ${Number(a?.by) || 600});
          return { y: Math.round(scrollY), height: document.documentElement.scrollHeight };
        `),
      ),
      host.serve('run', (a: { script?: string }) => {
        if (typeof a?.script !== 'string' || !a.script.trim()) throw new Error('Say what to run: script');
        return run(a.script);
      }),
      host.serve('screenshot', () => host.web.capture()),
      // Where the page goes, as it goes: until the caller stops.
      host.serve('watch', (_a, { signal, emit }) => {
        emit({ type: 'state', ...now() });
        return new Promise<null>((resolve) => {
          const hear = (e: WebEvent) => {
            if (e.type === 'navigate' || e.type === 'title' || e.type === 'loading' || e.type === 'fail' || e.type === 'crash') emit(e);
          };
          watchers.current.add(hear);
          signal.addEventListener('abort', () => {
            watchers.current.delete(hear);
            resolve(null);
          });
        });
      }),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [host]);
}
