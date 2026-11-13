// The device the page is shown as: a phone's, a tablet's or a computer's
// size (with its user agent), or a size of one's own, turned to landscape
// and back. It's in the window's data (`device`, `size`, `landscape`), so
// everyone on the project sees the page the same.

import type { Host } from '@hyperpane/sdk/client';
import { CUSTOM, parseSize } from '../lib/devices.ts';
import { type Entries, deviceMenu } from './menus.ts';
import type { Box, Viewport } from './useStage.ts';

export function useDevice(host: Host, data: Record<string, string>, view: Viewport | null, box: Box | null) {
  const landscape = data.landscape === '1';

  const set = (device: string | null) => {
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

  const rotate = () => host.win.setData('landscape', landscape ? null : '1');

  const menu = (): Entries => deviceMenu({ device: data.device, size: data.size, landscape, set, custom: () => void customSize(), rotate });

  return { landscape, rotate, menu };
}
