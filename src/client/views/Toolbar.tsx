// The Browser's bar: back, forward, reload (stop while it loads), the
// address field with how the page is secured and its bookmark star, then
// the device and its rotation, bookmarks, DevTools and the rest.

import type { RefObject } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronDown,
  Code,
  Ellipsis,
  FileText,
  Globe,
  Lock,
  Maximize,
  Monitor,
  RectangleHorizontal,
  RectangleVertical,
  RotateCw,
  Smartphone,
  Star,
  Tablet,
  TriangleAlert,
  X,
} from 'lucide-react';
import { keys } from '@hyperpane/sdk/client';
import { ToolButton, cn, styles } from '@hyperpane/ui';
import { display, security } from '../lib/address.ts';
import type { DeviceKind } from '../lib/devices.ts';

const DEVICE_ICONS = { phone: Smartphone, tablet: Tablet, computer: Monitor };

/** Where a menu opens under a button: its bottom left. */
export type Anchor = { x: number; y: number };
export const below = (e: React.MouseEvent): Anchor => {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left, y: r.bottom + 4 };
};

export function Toolbar({
  url,
  address,
  inputRef,
  suggestions,
  loading,
  nav,
  bookmarked,
  device,
  landscape,
  onAddress,
  onSubmit,
  onRevert,
  onBack,
  onForward,
  onReload,
  onStop,
  onMark,
  onDeviceMenu,
  onRotate,
  onBookmarksMenu,
  onDevtools,
  onMore,
}: {
  url: string;
  address: string;
  inputRef: RefObject<HTMLInputElement | null>;
  suggestions: string[];
  loading: boolean;
  nav: { back: boolean; forward: boolean };
  bookmarked: boolean;
  /** The device the page is shown as (null: Responsive). */
  device: { name: string; width: number; height: number; kind: DeviceKind } | null;
  landscape: boolean;
  onAddress(text: string): void;
  onSubmit(): void;
  onRevert(): void;
  onBack(): void;
  onForward(): void;
  onReload(): void;
  onStop(): void;
  onMark(): void;
  onDeviceMenu(at: Anchor): void;
  onRotate(): void;
  onBookmarksMenu(at: Anchor): void;
  onDevtools(): void;
  onMore(at: Anchor): void;
}) {
  const safety = security(url);
  const DeviceIcon = device ? DEVICE_ICONS[device.kind] : Maximize;
  const listId = 'browser-history';
  return (
    <div className="flex h-8 flex-none items-center gap-0.5 px-1.5">
      <ToolButton label={`Back (${keys('⌘[')})`} icon={ArrowLeft} disabled={!nav.back} onClick={onBack} />
      <ToolButton label={`Forward (${keys('⌘]')})`} icon={ArrowRight} disabled={!nav.forward} onClick={onForward} />
      {loading ? (
        <ToolButton label="Stop" icon={X} onClick={onStop} />
      ) : (
        <ToolButton label={`Reload (${keys('⌘R')})`} icon={RotateCw} disabled={!url} onClick={onReload} />
      )}

      <div
        className={cn(
          'rounded-control mx-1 flex h-6 min-w-0 flex-1 items-center gap-1.5 border border-[var(--node-border)] pr-0.5 pl-2 transition-colors duration-100',
          'focus-within:border-[var(--node-accent)] hover:border-[color-mix(in_srgb,var(--node-fg)_24%,transparent)]',
        )}
      >
        {safety === 'secure' ? (
          <Lock className="size-3 flex-none text-[var(--node-muted)]" aria-label="Secure" />
        ) : safety === 'file' ? (
          <FileText className="size-3 flex-none text-[var(--node-muted)]" aria-label="A file" />
        ) : safety === 'insecure' ? (
          <TriangleAlert className="size-3 flex-none text-[var(--ansi-3)]" aria-label="Not secure" />
        ) : (
          <Globe className="size-3 flex-none text-[var(--node-muted)]" />
        )}
        <datalist id={listId}>
          {suggestions.map((u) => (
            <option key={u} value={display(u)} />
          ))}
        </datalist>
        <input
          ref={inputRef}
          aria-label="Address"
          spellCheck={false}
          autoComplete="off"
          list={listId}
          placeholder="Search, or type an address, localhost:5173 or just 5173"
          value={address}
          onChange={(e) => onAddress(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={onRevert}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onRevert();
              e.currentTarget.blur();
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-xs text-[var(--node-fg)] outline-none select-text placeholder:text-[var(--node-muted)]"
        />
        {url && (
          <button
            type="button"
            title={bookmarked ? `Remove the bookmark (${keys('⌘D')})` : `Bookmark this page (${keys('⌘D')})`}
            aria-label={bookmarked ? 'Remove the bookmark' : 'Bookmark this page'}
            aria-pressed={bookmarked}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onMark}
            className={cn(
              'rounded-chip flex size-5 flex-none items-center justify-center transition-colors duration-100 hover:bg-[var(--node-hover,var(--node-header))]',
              styles.focusRing,
              bookmarked ? 'text-[var(--ansi-3)]' : 'text-[var(--node-muted)] hover:text-[var(--node-fg)]',
            )}
          >
            <Star className={cn('size-3.5', bookmarked && 'fill-current')} />
          </button>
        )}
      </div>

      <button
        type="button"
        title={device ? `${device.name}: ${device.width} × ${device.height}` : 'Responsive: the page fills the window'}
        onClick={(e) => onDeviceMenu(below(e))}
        className={cn(
          'rounded-control flex h-6 max-w-36 flex-none items-center gap-1 px-1.5 text-[var(--node-muted)] transition-colors duration-100 hover:bg-[var(--node-hover,var(--node-header))] hover:text-[var(--node-fg)]',
          styles.focusRing,
        )}
      >
        <DeviceIcon className="size-3.5 flex-none" />
        <span className="truncate">{device ? device.name : 'Responsive'}</span>
        <ChevronDown className="size-3 flex-none" />
      </button>
      {device && (
        <ToolButton
          label={landscape ? 'Turn to portrait' : 'Turn to landscape'}
          icon={landscape ? RectangleHorizontal : RectangleVertical}
          onClick={onRotate}
        />
      )}
      <ToolButton label="Bookmarks" icon={Bookmark} onClick={(e) => onBookmarksMenu(below(e))} />
      <ToolButton label={`Developer tools (${keys('⌥⌘I')})`} icon={Code} disabled={!url} onClick={onDevtools} />
      <ToolButton label="More" icon={Ellipsis} onClick={(e) => onMore(below(e))} />
    </div>
  );
}

/** A thin line under the bar while the page loads, creeping on until it's
 * done. */
export function Progress({ value }: { value: number | null }) {
  return (
    <div className="relative h-0.5 flex-none">
      {value !== null && (
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--node-accent)] transition-[width] duration-150" style={{ width: `${value * 100}%` }} />
      )}
    </div>
  );
}
