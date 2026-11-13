// The Browser's keys while the frame has them (the page's own come as its
// `key` events): the address bar, reload, back and forward, the bookmark
// star, and the developer tools.

import type { Host } from '@hyperpane/sdk/client';
import { mod, shortcutKey } from '@hyperpane/sdk/client';

export function frameKeys(host: Host, o: { focusAddress(): void; reload(hard?: boolean): void; toggleMark(): void }) {
  return (e: React.KeyboardEvent) => {
    let act: (() => void) | null = null;
    const k = shortcutKey(e);
    if (e.key === 'F12' && !e.altKey && !e.shiftKey && !mod(e)) act = () => host.web.devtools();
    else if (mod(e) && e.altKey && !e.shiftKey && k === 'i') act = () => host.web.devtools();
    else if (mod(e) && !e.altKey) {
      if (k === 'l' && !e.shiftKey) act = o.focusAddress;
      else if (k === 'r') act = () => o.reload(e.shiftKey);
      else if (k === '[' && !e.shiftKey) act = () => host.web.back();
      else if (k === ']' && !e.shiftKey) act = () => host.web.forward();
      else if (k === 'd' && !e.shiftKey) act = o.toggleMark;
    }
    if (!act) return;
    // ⌘R would reload the app: this window's page instead.
    e.preventDefault();
    e.stopPropagation();
    act();
  };
}
