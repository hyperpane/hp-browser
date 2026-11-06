// What's typed in the address bar, as an address to open, and how an
// address shows there.

/** Where searches go, by the `searchEngine` setting; `%s` is the query. */
export const ENGINES: Record<string, string> = {
  duckduckgo: 'https://duckduckgo.com/?q=%s',
  google: 'https://www.google.com/search?q=%s',
  bing: 'https://www.bing.com/search?q=%s',
  brave: 'https://search.brave.com/search?q=%s',
  startpage: 'https://www.startpage.com/do/search?q=%s',
  ecosia: 'https://www.ecosia.org/search?q=%s',
};

/** The search address the settings pick: an engine, or the custom one. */
export function searchUrl(engine: string | undefined, custom: string | undefined): string {
  if (engine === 'custom') {
    const url = custom?.trim();
    if (url && /^https?:\/\//i.test(url)) return url.includes('%s') ? url : `${url}%s`;
  }
  return ENGINES[engine ?? ''] ?? ENGINES.duckduckgo;
}

export function search(query: string, engine: string): string {
  const q = encodeURIComponent(query.trim()).replace(/%20/g, '+');
  return engine.replace('%s', () => q);
}

function isPort(text: string): boolean {
  return /^\d{1,5}$/.test(text) && Number(text) > 0 && Number(text) < 65536;
}

/** `host:port` as the host and the port, if it has one (`[::1]:3000` too). */
function splitPort(host: string): [string, string | null] {
  const at = host.startsWith('[') ? host.indexOf(']:') + 1 : host.lastIndexOf(':');
  return at > 0 && isPort(host.slice(at + 1)) ? [host.slice(0, at), host.slice(at + 1)] : [host, null];
}

function encodePath(path: string): string {
  return path.replace(/[^A-Za-z0-9/\-_.~]/g, (c) => encodeURIComponent(c));
}

/** A file's path as a `file://` address: `file:///Users/me/a.html`, and on
 * Windows `file:///C:/Users/me/a.html`. */
export function fileUrl(path: string): string {
  if (/^[A-Za-z]:(\/|$)/.test(path)) return `file:///${path.slice(0, 2)}${encodePath(path.slice(2))}`;
  return `file://${encodePath(path)}`;
}

/**
 * The address for what's typed: an address as it is; `5173` or `:5173` for
 * a dev server on this machine; `localhost:5173`, an IP or a host with a
 * port over http; `example.com` over https; a path (`/…`, on Windows `C:\…`)
 * as a file; anything else (words, one word) as a search. Null for nothing
 * typed.
 */
export function urlFor(typed: string, engine: string, windows = false): string | null {
  let text = typed.trim();
  if (!text) return null;
  if (/^(https?|file):\/\//i.test(text) || /^about:blank$/i.test(text)) return text;
  const port = /^:?(\d{1,5})(\/.*)?$/.exec(text);
  if (port && isPort(port[1])) return `http://localhost:${port[1]}${port[2] ?? ''}`;
  if (windows && /^[A-Za-z]:[\\/]/.test(text)) text = text.replace(/\\/g, '/');
  if (text.startsWith('/') || (windows && /^[A-Za-z]:\//.test(text))) return fileUrl(text);
  if (/\s/.test(text)) return search(text, engine);
  const host = text.split(/[/?#]/)[0];
  const [name, hasPort] = splitPort(host);
  const local = /^localhost$/i.test(name) || /\.localhost$/i.test(name) || /^\d{1,3}(\.\d{1,3}){3}$/.test(name) || (name.startsWith('[') && name.endsWith(']'));
  if (local || (hasPort && name)) return `http://${text}`;
  if (name.includes('.') && !name.startsWith('.') && !name.endsWith('.')) return `https://${text}`;
  return search(text, engine);
}

/** An address as the address bar shows it: without a lone trailing slash. */
export function display(url: string): string {
  const m = /^([a-z]+:\/\/[^/?#]+)\/$/i.exec(url);
  return m ? m[1] : url;
}

export type Security = 'secure' | 'insecure' | 'local' | 'file' | 'other';

/** This machine, a private address, or a name that only resolves locally. */
function isLocalHost(name: string): boolean {
  name = name.replace(/^\[|\]$/g, '').toLowerCase();
  if (name === 'localhost' || /\.(localhost|local|test)$/.test(name)) return true;
  const ip = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(name);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    return a === 127 || a === 10 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  if (name.includes(':')) return name === '::1' || name === '::' || /^f[cd]/.test(name);
  return !!name && !name.includes('.');
}

/** How an address's connection is secured, as the address bar shows it. */
export function security(url: string): Security {
  const m = /^([a-z]+):\/\/([^/?#]*)/i.exec(url);
  if (!m) return 'other';
  const scheme = m[1].toLowerCase();
  if (scheme === 'https') return 'secure';
  if (scheme === 'file') return 'file';
  if (scheme !== 'http') return 'other';
  const host = m[2].split('@').pop() ?? '';
  return isLocalHost(splitPort(host)[0]) ? 'local' : 'insecure';
}

/** The host, for a title: `localhost:5173`, `example.com`. */
export function hostOf(url: string): string {
  const m = /^[a-z]+:\/\/([^/?#]*)/i.exec(url);
  if (!m) return '';
  return (m[1].split('@').pop() ?? '').replace(/^www\./i, '');
}

/** Chromium's errors, plainly. */
export function failure(code: number, description: string): string {
  if (code === -102) return 'Nothing answered there. Is the server running?';
  if (code === -105 || code === -137) return 'There’s no such host.';
  if (code === -106) return 'This computer is offline.';
  if (code === -118 || code === -7) return 'The connection timed out.';
  if (code === -6) return 'There’s no such file.';
  if (code === -10) return 'The page isn’t allowed to open that.';
  if (code <= -200 && code > -300) return 'The site’s certificate isn’t trusted.';
  if (code === -300) return 'That isn’t an address a page can open.';
  return description.replace(/^ERR_/, '').replace(/_/g, ' ').toLowerCase() || 'The page didn’t load.';
}
