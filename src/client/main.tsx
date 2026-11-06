// The Browser's frame: one window on the canvas, one page in it. React, the
// SDK, the UI kit and Lucide come from the app.

import { mount } from '@hyperpane/sdk/client';
import { NodeMessage } from '@hyperpane/ui';
import { Browser } from './app/Browser.tsx';

mount((host) => (host.view.type === 'node' ? <Browser host={host} /> : <NodeMessage error>The Browser has no “{host.view.type}” view.</NodeMessage>));
