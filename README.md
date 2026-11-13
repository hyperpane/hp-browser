# Browser

A real web page on the canvas: one page per window, no tabs. It's
Chromium, the app's own: a sandboxed page with nothing of the app's, its
cookies and sign-ins kept for the Browser alone. The desktop app only.

## Using it

- **A new Browser:** the globe in the canvas's toolbar, beside the drawing
  tools (right-click it to hide it; Plugins → Browser shows it again).
- **The address bar** takes a URL, `localhost:5173`, just a port (`5173`),
  a file's path, or words to search (the search engine is a setting).
- **Back, forward, reload** in the bar; ⌘[ and ⌘], ⌘R (⇧⌘R ignores the
  cache).
- **⌘-click a link** (Ctrl+Click on Windows and Linux), or a link that opens
  a new window, and it opens in **a new Browser window** on the canvas.
  The page's right-click menu has Open Link in New Window too.
- **Devices:** the menu beside the address bar shows the page at a phone's,
  a tablet's or a computer's size, with its browser's user agent, scaled to
  fit the window; or a size of your own (Custom Size…). Turn it to
  landscape and back with the button next to it.
- **Bookmarks:** the star in the address bar bookmarks the page (⌘D). They
  show in the bar under it (a setting), in the Bookmarks menu, and on a
  blank window. ⌘-click one to open it in a new window; right-click to
  rename, move or remove it. They're kept on this computer, for every
  Browser window.
- **Developer tools:** the `</>` button, ⌥⌘I or F12, or Inspect Element in
  the page's right-click menu.

The page, the device and its turn are kept in the project, so everyone on
it sees the same.

## What's where

| File | What it is |
|---|---|
| `plugin.json` | The manifest: the window type, its settings, and the `webview` permission. |
| `src/client/main.tsx` | The frame's entry. |
| `src/client/app/Browser.tsx` | The window, put together from the parts below. |
| `src/client/app/usePage.ts` | The page (`host.web`): where it is, the address bar's text, its load, its events. |
| `src/client/app/useStage.ts` | Where the page goes in the frame, a device's size scaled to fit. |
| `src/client/app/useDevice.ts` | The device it's shown as, a custom size, the turn to landscape. |
| `src/client/app/useMarks.ts` | Bookmarks as the window uses them: the star, opening one, their menus. |
| `src/client/app/useWindow.ts` | A new window's home page and device; the window's title and header menu. |
| `src/client/app/keys.ts` | The keys while the frame has them. |
| `src/client/app/useProgress.ts` | The load's progress bar. |
| `src/client/app/menus.ts` | The menus: devices, bookmarks, a bookmark's, the page's right-click. |
| `src/client/views/` | The bar (`Toolbar.tsx`), the bookmarks (`Bookmarks.tsx`), a device's outline and a page's error (`Stage.tsx`). |
| `src/client/lib/` | What the address bar takes (`address.ts`), devices (`devices.ts`), bookmarks and history (`store.ts`). |

The page itself is the app's (`sdk/RPC.md` §8): a plugin with the `webview`
permission asks for one with `host.web.load(url)` and says where it goes in
its frame with `host.web.place(rect)`.
