# wb_web

The whiteboard's frontend, rewritten in React, MobX and TypeScript, built by Vite
into a **single self-contained `index.html`** (scripts, styles and icons inlined;
nothing loaded from anywhere else). It talks to [wb_server](../wb_server) and
replaces the old jQuery page.

## Running it

Node is pinned in `.nvmrc`.

```bash
npm install
npm run dev      # dev server at http://localhost:5173/whiteboard/
npm test         # vitest, once
npm run build    # type-check, then dist/index.html
```

`npm run dev` proxies `/whiteboard/api` and the `/whiteboard/ws` WebSocket to a
wb_server on `127.0.0.1:8181`. To
serve the built page from wb_server instead, set its `static_dir` to `wb_web/dist`.
In production, `dist/index.html` is the page at `/whiteboard/`.

## How it's put together

```
src/
  main.tsx, App.tsx        start-up: join the board in the URL, keyboard shortcuts
  api.ts                   typed client for the server's upload protocol, over HTTP
  socket.ts                the same protocol over the WebSocket, kept alive
  nav.ts                   URL hash via pushState/replaceState
  remoteLog.ts             log lines to the server, when its stream_logs is on
  stroke.ts, geometry.ts   strokes: stored format, smoothing, drawing
  grid.ts                  the background grids
  stores/                  MobX state
    toolStore              tool, colour, size, grid settings
    drawingStore           the strokes, with undo/redo
    boardStore             sharing, joining, polling, syncing
    uiStore                sidebar sections, popup, saved images
  components/
    BoardCanvas            the canvas layers and pointer input
    Sidebar, Popup, ExpandableSidebarElement, GridIcon, icons
```

**Strokes** are stored exactly as the old client wrote them,
`{"p":[x1,y1,x2,y2,...],"c":"#rrggbb","t":"pen"|"highlighter"|"eraser","w":width}`,
so boards drawn with the old client still load. They're drawn with the old client's
Bézier smoothing (ported from `flow.js`). Points closer than 30 ms apart are dropped
while drawing, which also smooths the curve.

**Drawing** uses stacked canvases, so little ever needs repainting:

- *baked*: all shown strokes but the newest few, drawn once
- *live*: the newest five, redrawn on change (so undo is cheap)
- *settled*: the stroke being drawn, as far as its shape is final; only added to
- *tail*: that stroke's newest segment, which changes until the next point
  arrives; the only thing redrawn per frame, and only its own area
- *grid*: on top, so the eraser (which paints white) never hides it

Each segment of a curve depends only on its neighbouring points, so all but the
newest segment of a stroke in progress are final. Repainting therefore costs the
same at point 5,000 as at point 5. The highlighter is painted opaque on the
in-progress layers and faded as a group, so overlaps don't darken.

**Grids** are built as rectangles in one 100px tile, then repeated across the
canvas (`createPattern`). Dotted lines use an odd number of square dots per
segment, `n = floor((length - width) / 2 / width)`, less one if even, so one dot
always sits in the middle and the gaps are equal. Colours and widths are listed at
the top of `grid.ts`. The sidebar previews are the same tile, shrunk.

**Syncing** (`boardStore`, `socket.ts`): joining a board is over HTTP. Then the
WebSocket rejoins as the same client, catches up from where the page has read
to, and from then on the server pushes new rows and writes go over the socket.
Whenever the socket is down, the page polls over HTTP every second instead, and
a write the socket dropped is resent over HTTP. Both are safe to overlap:

- rows carry their id, and the page skips any at or below what it has read;
- writes are idempotent on the server, named by (client, code): the page
  numbers its strokes and clears from one counter, so a resend is recognised.

The socket answers the server's pings, and treats 25 s of silence as a dead
connection. It reconnects with backoff (1 s doubling to 30 s). When the page
becomes visible, is restored from the back-forward cache, or comes back online,
it checks at once: with no socket it redials, and with one it pings and gives
up after 5 s without an answer.

**URLs**: a shared board is `/whiteboard/#<hash>`. The hash is set with
`pushState`, never `location.hash`, because on plain-http pages iOS Safari turns a
hash change into a full reload. Back returns to the unshared page; if the hash
changes in any way the page didn't make itself, the page reloads to match.

## Conventions

One MobX store class per concept, `makeAutoObservable(this)` in the constructor,
each exported as a class (tests build fresh ones) and as a singleton (components
import it). Anything that talks to the outside (`UploadApi`, `Live`, `Nav`, the
socket factory) is passed into its store or class, so tests use fakes. Components
that read stores are wrapped in `observer()`. MobX 7 names
its annotations as exports: `observableShallow`, not `observable.shallow`.
