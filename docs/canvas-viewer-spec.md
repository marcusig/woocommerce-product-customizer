# Canvas viewer (2D, Pixi)

Status: **phases 1 and 2 done (2026-11-04, branch `canvas-viewer`).** All decisions answered
([Decisions](#decisions)). Draft code exists on `origin/v2/add-canvas-view`
(`src/assets/js/views/parts/viewer-pixi.js`, Oct 2025). It predates the current viewer and is
written against Pixi v7, so it is reference material, not a base to merge. See
[What to keep from the draft](#what-to-keep-from-the-draft).

A second implementation of the 2D viewer that draws every layer into one Pixi application instead
of stacking one `<img>` per layer. The `<img>` stack stays, and stays the default.

**Why now:** it is the prerequisite for the image upload preview (customer images placed in an
admin-defined zone, with masks, shading and warp), which needs blending and masking across layers -
something separate DOM elements cannot do. It is also what
[per-view image order](https://claude.ai/artifact/CzXDxyxiS6SysC4Kc544mR) was deferred to ship with.

## Goals and non-goals

Goals:

- Same picture as the `<img>` stack for every existing 2D configurator: same layers, same order,
  same visibility rules, same images.
- Implements the viewer contract in `configurator.js` (`render()`, `capture()`), so cart image,
  PDF and Save your design work without knowing which viewer is mounted.
- A scene graph add-ons can draw into (text overlay first, image overlay next).
- Per-view stacking order is cheap, because restacking is a re-sort of scene nodes.
- Never worse than the stack when something goes wrong: no WebGL, lost context, or images it
  cannot use all fall back to the `<img>` stack, not to a blank viewer.

Non-goals (for this spec):

- The image overlay itself, masks, STMaps, shading passes. They build on this; separate spec.
- Changing how the **server** composes 2D images for cart and orders (`Configuration::get_image()`
  still merges layer files). See [Cart and order images](#cart-and-order-images).
- Zoom and pan. The scene makes them easy later; nothing here depends on them.
- Replacing the 3D viewer's renderer.

## Choosing the viewer

It is a **renderer of the 2D configurator**, not a configurator type. `mkl_pc_get_configurator_types()`
gates admin settings (every 3D field keys on `'3d'`), and a third type would have to be threaded
through all of them for no gain - the data is identical.

- New **global** setting `viewer_2d_renderer`: `dom` or `canvas`. No per-product override for
  now (decision A); add one if it is asked for. Filters cover per-product needs in the meantime.
- Default: `dom` everywhere until phase 5 has shipped; from then on `canvas` for new installs only,
  existing installs keep `dom` (decision B - the `viewer_active_images_only` rollout).
- PHP filter `mkl_pc_viewer_2d_renderer( $renderer, $product_id )`, exposed to the front end as
  `PC.fe.config.viewer_2d_renderer`.
- Wired through the existing seam: a `PC.fe.viewer.main_view` filter returns
  `PC.fe.views.viewer_canvas` when the renderer is `canvas` and the product is not 3D. The 3D
  filter in `3d-viewer.js` keeps precedence.
- Final say in JS: filter `PC.fe.viewer.renderer( renderer, product_data )` (`'dom'|'canvas'`;
  anything else counts as `dom`).
- Every fallback below fires `PC.fe.viewer.canvas.fallback( reason, detail, viewer|null )` and logs
  one line naming the reason. Reasons: `pixi_missing`, `webgl`, `dom_item_view`, `cors`,
  `context_lost`. Pixi is only enqueued for 2D products on the canvas renderer, so `pixi_missing`
  means a filter asked for canvas where PHP did not.

**Fallback is decided before mounting, then once more at runtime:**

| When | Condition | Result |
|---|---|---|
| Before mount | WebGL unavailable | `<img>` stack; fire `PC.fe.viewer.webgl.unavailable` |
| Before mount | A visible layer uses a DOM-only item view and no canvas item is registered for it (see [Add-ons](#add-ons)) | `<img>` stack; console notice naming the layer |
| Runtime | An image cannot be uploaded as a texture (cross-origin without CORS headers) | Remount as `<img>` stack for the session; console notice with the URL |
| Runtime | Context lost and not restored within 3 s | Remount as `<img>` stack |

A runtime fallback replaces the viewer **in place** (`replaceWith`, so it keeps its position among
the modal's children; `PC.fe.mountViewer()` would append it at the end), sets `PC.fe.modal.viewer`,
and moves along anything appended to the old root after it rendered (the empty configurator's
toolbar, Save your design's loading message). Pixi missing, no WebGL and every runtime reason
disable the canvas for the rest of the page view; `dom_item_view` belongs to one product and does
not.

**The CORS row matters more than it looks.** The `<img>` stack displays cross-origin images fine and
only fails at capture. WebGL cannot even *upload* a cross-origin image without CORS, so a shop
whose images sit on a CDN or offload bucket without `Access-Control-Allow-Origin` would get an
empty viewer. Textures load with `crossOrigin: 'anonymous'`, and the first failure of that kind
triggers the fallback. Admin hint on the setting: "Images must be served from this site or with
CORS headers."

## Markup

Same root as the other viewers, so theme layout keeps working:

```
div.mkl_pc_viewer.mkl_pc_viewer--canvas      ← template mkl-pc-configurator-viewer
  (angles selector, as today)
  div.mkl_pc_layers                          ← kept: swipe (pc-fe-main.js) and SYD bind to it
    canvas.mkl_pc_canvas                     ← the Pixi canvas, aria-hidden
    img.mkl_pc_canvas_probe                  ← one per angle shown, hidden (see Fit)
    div.custom-html …                        ← custom HTML, direct children as in the stack,
                                               so theme rules for them still match
    img.mkl_pc_canvas_marker                 ← hidden; carries `loading` while the picture loads,
                                               so themes' `img.loading ~ .images-loading` shows
                                               their indicator
    div.images-loading
```

Kept on the root: `is-loading-image` while textures for the current picture load, and anything
`PC.fe.viewer.render.before` / `PC.fe.viewer.render` hooks add (the `ev` theme, SYD's loading
message).

**Lost, and documented as such:** per-image classes (`active`, `current_layer`, layer and choice
`class_name`, `retired`), the `data-layer` / `data-choice` attributes, CSS transitions or filters on
individual images, and selectors such as `img:not(.active)`. This is the main reason `dom` stays the
default: stores may have CSS that depends on that markup.

## Scene

```
app.stage
  fit                       ← scaled and centred to the canvas ("contain")
    angle_stack[angle_id]   ← one per angle that has been shown; only the active one is visible
      layer_node[layer_id]
        choice_node[layer_id:choice_id]
    snapshot[angle_id]      ← a flat copy of a left angle (see Snapshots); shown for the outgoing
                              view during a switch, and for an angle coming back while it reloads
```

- Nodes are keyed `layer_id:choice_id`, like `viewer.layer_views` - choice ids repeat across layers.
- `layer_node`s live in a container with `sortableChildren`; their `zIndex` is the resolved order.
  Restacking is setting `zIndex` and one sort, not removing and re-adding nodes.
- Within a layer, choices sort by their index in the layer content (multiple-choice layers show
  several), then custom HTML after the image - the same tuple as `viewer.sort_key()`.
- `angle_stack`s are created lazily on first display, not one per angle up front.
- Static (`not_a_choice`) layers are a `layer_node` with one always-visible choice node.

**Fit.** The canonical size of an angle is read from the choices' stored image dimensions
(`get_image( 'image', 'dimensions' )`), not from the first texture that happens to load, so the
picture does not jump when a larger image arrives. If no dimensions are stored, the first loaded
texture of that angle sets it. Renderer resolution: `min( devicePixelRatio, 2 )`, `autoDensity`.
Resized through a `ResizeObserver` on `.mkl_pc_layers`.

Where the picture goes is **measured, not computed**. Themes size layer images differently (all
centre them and cap `max-height: 100%`; some also cap the width; lebolide changes layout on small
screens), and a store may add its own rules. Each angle gets a hidden probe `<img>` whose source is
an empty SVG of the angle's size, so the theme lays it out exactly as it would a real layer image;
the angle's container is placed on the probe's box. If the probe has no box (a stylesheet hides it),
the fit is "contain, never upscale", centred. On product 613 the canvas lands within a third of a
pixel of the `<img>` stack on desktop and at 375 px wide.

Every image of an angle is drawn at its natural size, centred on the angle's box, with one scale for
the angle. The `<img>` stack scales each image on its own; the two only differ for an image whose
size differs from the rest of its angle, where the canvas keeps the layers registered.

## What is shown

One rule for every viewer, in `PC.fe.viewer_state` (`views/parts/viewer-state.js`, phase 1). The
pool's `get_visible_choices()` and the viewer's `get_capture_models()` used to say it twice; both
now call it, and the canvas viewer will too:

- `is_layer_hidden( layer )`: `cshow`, and `PC.conditionalLogic.parent_is_hidden`;
- `is_choice_hidden( choice )`: `PC.conditionalLogic.item_is_hidden`, or the plain `cshow` flags;
- `shown_choices( layer )`: active choices, not `is_group`, not hidden; a static layer's first
  choice; nothing when the layer is hidden;
- `has_drawable( choice )`: an image, or `PC.fe.viewer.item.render.empty.images` says to render it
  anyway. Separate from `shown_choices()` because `capture()` never applied it (choices without
  an image resolve to "nothing to draw" there), and folding it in would change what
  `PC.fe.viewer.capture.models` receives;
- `layers_in_image_order()` and `picture()` (every shown choice, bottom layer first).

`layers_in_image_order()` takes no angle yet; phase 6 adds the angle and rung 1 of the ladder.

Never decided from CSS classes (contract rule). Start-up state: the viewer builds from the models
after `PC.fe.prepare_config`, so conditions applied before any view exists are already in `cshow`.
It listens to `change:active` / `change:cshow` on choices and `change:cshow` on layers, and
re-syncs a layer at the end of the turn - the same two-step reason as `viewer_layer_pool.sync()`:
a choice change arrives as "old inactive" then "new active", and acting on the first would empty
the layer.

**Swaps never flash.** The outgoing choice's sprite stays, under the incoming one, until everything
its layer is loading has settled, or `PC.fe.viewer.swap_timeout` (5000 ms) passes - the pool's
hold/incoming behaviour. `PC.fe.viewer.hold_previous_image( hold, entry, viewer )` is honoured; the
second argument is the leaving item, whose `model` is its choice. One improvement on the pool: when
selections change faster than images load (A → B → C), A stays up until C arrives instead of going
when the never-shown B is dropped.

**Angles never show half a picture.** The current angle stays on screen until the new angle's
picture has settled (or the swap timeout passes), then they swap. Angles already shown keep their
sprites, so going back is immediate. A cross-fade can be enabled with
`PC.fe.viewer.canvas.fade_duration` (default `0`); the DOM viewer reads this from CSS, which the
canvas does not have.

## Order

The resolution ladder from the per-view image order spec, per layer, for the active angle:

1. `image_order_by_angle[ angle_id ]` if set;
2. `image_order`, when any layer has a non-zero value;
3. `order`.

Until the per-view data exists, rung 1 never matches and the canvas viewer orders exactly as the
`<img>` stack does. Restack on `PC.fe.angles` `change:active`, skipped when a precomputed
"any per-view override?" flag is false. Unlike the DOM restack (which the per-view spec measured at
~24,000 comparisons on product 636, 155 layers, done naively), this is one `zIndex` pass.

## Textures

Pixi v8 rules this design follows: `TextureSource` instead of `baseTexture`, `await app.init()`
before anything touches the renderer, `app.canvas` rather than `app.view`.

**The viewer loads and owns its images** (`Image` → `img.decode()` → `PIXI.Texture.from( image )`),
rather than using `PIXI.Assets`. Assets is one cache for the whole page: unloading it on teardown
races with a viewer mounting again as the modal reopens, which could hand the new viewer a texture
being destroyed. Owning them is also what eviction (below) needs. The browser's HTTP cache keeps a
second load cheap; `crossOrigin` is set only for other domains, so same-origin requests reuse the
`<img>` stack's cache entries.

`img.decode()` stays pending while the page is not rendered (a background tab, a hidden pane). It
is raced against one second, then the texture is uploaded anyway, so a capture asked for in the
background still resolves.

**Which URL.** The responsive pick from `viewer_layer.render()`: `url_mobile` below
`mobile_image_breakpoint`, `url_large` at or above `large_image_breakpoint`. It uses the same width
as the stack (the modal's), so both viewers request the same files. A resize that crosses a
breakpoint resyncs every layer; each one swaps to the new file the way a selection change does,
holding the old image until the new one has loaded.

**How sharp.** A texture keeps only the resolution the box shows: the device pixels one image
pixel covers (the stack's scale × the renderer's resolution), rounded up to a step of √2 and never
above full size (`scale_step()`). A texture holds at most twice the pixels on screen, and a resize
reloads nothing until the box has grown by a whole step. Then the same texture record is upgraded
and every sprite drawing it switches over (`check_resolution()`, 250 ms after the resize settles).
Shrinking keeps the sharper textures. Downscaled copies come from `createImageBitmap()` (resized
off the main thread, created premultiplied: WebGL ignores the premultiply-on-upload flag Pixi sets
for bitmaps), or a 2D canvas where the browser ignores the resize options. Textures are built with
`new PIXI.Texture( { source: new PIXI.ImageSource( ... ) } )`, never `PIXI.Texture.from()`, which
caches by resource for the whole page.

Measured on 7859 (3840×2160 images, a 505 px box at resolution 1): 679×382 textures, the first
picture of 150 images in 148 MiB instead of 4.6 GiB, loaded in 5 s on desktop Chrome. On-screen
colour checked: every stripe pixel drawn at full alpha reads back with its placeholder's exact
colour.

**Decoding, a few at a time.** Whatever size the texture ends up, the image is first decoded at
full size: width × height × 4 (32 MiB for 3840×2160) until the smaller copy exists. Started all
together, the first picture of a product with many layers briefly needs every one of those at once;
that is what made iOS Safari kill the tab on 7861 and 7859 (iPhone XS, 2026-11-05). So downloads run in
parallel, but decoding and building the texture wait for a slot (`decode_slot()`): 6 at a time,
3 below the mobile breakpoint, filter `PC.fe.viewer.canvas.decode_limit( limit, viewer )`. Once a
downscaled copy exists, the full-size image drops its `src` so the browser can release it (a
texture drawn from the image itself, at full size, keeps it). Capture uses the same limit as its
batch size. On desktop Chrome, 7861's first picture still loads in 1.5 s at both limits; at
375 px (resolution 2) its textures are 960×540, 59 MiB for the picture.

Each load waiting for a slot carries a `wanted` check, asked when its turn comes: an entry's load
is wanted while its angle is shown or coming, a hover preload while its angle is the one coming,
a background load until the background job stops. Several callers waiting on one URL share the
load; it is given up only when none of them wants it. A load given up resolves with
`PC.fe.views.viewer_canvas.abandoned`, and its entry leaves the layer, so showing that angle again
creates and loads it anew. Switching angles fast therefore only decodes for where the customer
ends up: on 7861 at 375 px, 40 switches 20 to 170 ms apart gave up 420 queued decodes and ran
61, and every angle was complete when visited afterwards.

**When.** `image_loading_mode`:

- `lazy` (default): load what the current picture needs; preload on the choice's `preload-image`
  event (hover or focus), as the pool does.
- otherwise: after the current picture is complete, load every image of the active angle in the
  background, two at a time, while each fits in the free budget (estimated from the stored
  dimensions). Stops at the first that does not fit, or on an angle change.

**Memory budget.** This is the risk the `<img>` stack never had: the browser evicts decoded images
under pressure, while every GPU texture stays until it is destroyed. Choices × angles × full-size
images exhausts mobile Safari.

- Budget in bytes (`width × height × 4`), filter `PC.fe.viewer.canvas.texture_budget`. Defaults:
  256 MB, 96 MB when the viewer is under `mobile_image_breakpoint` (decision F); confirmed or
  adjusted by the phase 3 measurements.
- Textures used by the visible picture, and by the incoming picture during an angle switch, are
  pinned, as are textures an entry of either is waiting for. Everything else is
  least-recently-used and destroyed when over budget. (Until snapshots, below, the outgoing
  picture stays up and pinned during a switch: on 7861 at 375 px that is ~100 MiB, two pictures.)
- Background loads never release anything to make room; they stop when the next would exceed the
  budget. A hover preload is one image the customer is about to pick, so it may release unpinned
  textures like any load. Neither ever touches a pinned texture.
- Released textures take their sprites with them. They belong to angles not on screen; showing
  that angle again loads those images again.
- The budget is checked after each load, after an angle switch (the outgoing angle is no longer
  pinned) and after a resize (the budget is smaller below the mobile breakpoint).
- `texture_stats()` on the viewer returns `{ count, bytes, pinned_bytes, budget }` for measuring.
- The viewer owns what it loads; add-on items own and destroy their own textures.

**Loading state.** `is-loading-image` on the root, `PC.fe.viewer.layer.preload.complete` per item
and `PC.fe.viewer.layers.preload.complete` when the current picture is complete - the names the
stack fires, counted per *picture*, so a background load never holds the loading class.

## Snapshots

*Built 2026-11-05 (phase 4).* One goal of the canvas is transitions between views,
so two views must be on screen together. Two layered pictures at once double the pinned memory,
which is what a phone cannot afford (7861: 59 MiB per picture against a 96 MiB budget). The
outgoing view does not need its layers, though: nothing changes in it while it leaves. So it is
drawn once, flat, and the flat copy is what leaves.

**What.** A snapshot is one `RenderTexture` of an angle's picture the size of the canvas, at the
renderer's resolution, ×4 bytes: on 7861, 0.4 MiB at 375 px (resolution 2), 0.6 MiB on desktop.
One per visited angle, so 4 angles cost a few MiB however many layers they have. Rendered from
the angle's stack (its `frame`, below) into the texture: one `renderer.render()`, GPU only. Drawn
back as a sprite at the canvas origin, it lines up with the live stack to within a one-pixel
column at the picture's edge (0.09% of the channels differ on 7861 at 375 px, from the sub-pixel
position). It includes canvas
add-on items (phase 5), since they draw in the stack; not custom HTML, which is DOM.

**Taken** when an angle is left with its picture complete (at the start of the switch, from the
stack on screen), and again when a complete picture is left after changes. Never from an
incomplete picture: then the angle has no snapshot.

**Valid** while what the angle would draw is unchanged, where it would draw it. Each snapshot
stores two keys: `picture_key()`, the ordered list of files the angle draws, as `sync_stack()`
would pick them now; and `layout_key()`, the canvas size and resolution and the stack's position
and scale. A choice change made on another angle, a breakpoint crossed or any resize makes it
stale (stricter than a √2 step, and simpler: resizes are rare). A stale snapshot is destroyed, not
shown; after a resize, the ones that no longer line up are dropped 250 ms later
(`prune_snapshots()`).

**How it is drawn.** A snapshot shown in place of a stack is a *cover* (`make_cover()`). There is
at most one, and it always stands for the current stack: the outgoing one while the incoming angle
loads, or the incoming one, which becomes current at once, while its layers reload. The current
stack's textures are pinned only while it is drawn live (`live_stacks()`): not under a cover,
unless a transition is moving it. Once the stack under a cover is complete, `reveal()` draws it
instead, with no transition (same angle, same pixels). A cover drawn while its own stack reloads
stays until the stack is complete even if a choice changes meanwhile: that is the stack's "the old
image stays until the new one has loaded", for the whole picture. A resize that moves the stack
drops the cover (`uncover()`) rather than leave it misplaced.

Each stack's container sits in a `frame` container; transitions move and fade frames (a cover has
its own), while `layout()` keeps placing the containers inside them.

**Used for:**

1. *The outgoing view.* At an angle switch the outgoing stack is replaced on screen by its
   snapshot sprite, and the stack is hidden. Its textures are no longer pinned, so they compete in
   the budget like any cached angle. Pinned during a switch: the incoming picture, plus 1.2 MiB.
2. *Transitions.* `fade` and the slides run between the outgoing snapshot and the incoming view.
   The incoming side is its live stack once complete, or its valid snapshot at once (then the
   live stack takes over when complete; same textures, same size, no visible change). With
   neither, the outgoing snapshot stays until the incoming picture is complete or
   `PC.fe.viewer.swap_timeout` passes, as the stack does today, then the transition runs.
3. *Coming back.* An angle with a valid snapshot shows at once while its layers reload behind
   it, including after the budget released them. On a phone this lets the budget hold only the
   picture on screen without angle switches looking slower.

**What stays the same.** Choice swaps within an angle: unchanged (the old image stays until the
new one has loaded; snapshots are not involved). Capture: never from snapshots, which are at
screen size; it keeps its own path. The loading state: `is-loading-image` and
`PC.fe.viewer.layers.preload.complete` still follow the live picture, even while a snapshot
covers it.

**Checked** at 375 px on 7861 (desktop Chrome): leaving an angle covers it with its snapshot;
coming back to any visited angle shows its snapshot at once, then the live stack; pinned memory
during switches peaked at 59 MiB, one picture, against ~117 MiB before. With a choice changed on
another angle, the stale snapshot was dropped and the outgoing cover held until the angle had
loaded. 80 clicked choice and angle changes each with `slide-horizontal` and `fade` ended with one
stack visible, no cover or frame left over, and the picture as the models say. A context loss
mid-switch dropped the cover and every snapshot and restored normally; 8 remounts left one canvas
and no warnings. On 7860 at desktop width, 40 clicked changes drew exactly what the models say.

**Lifetime.** Destroyed when stale, on `remove()`, and on context loss (a render texture's
content does not survive a lost context; Pixi cannot re-upload it). Counted separately in
`texture_stats()` as `snapshot_bytes`, outside the budget: they are bounded by the angle count.

**Decided (Marc, 2026-11-05):**

- The outgoing angle's layer textures are left to the LRU, also on phones, not released as soon
  as its snapshot exists: a return looks instant either way, and kept textures make it complete
  sooner.
- Coming back to an angle whose snapshot is stale holds the current view until that angle is
  complete (today's behaviour). A stale snapshot is never shown: it would show choices the
  customer has since changed.

## Keeping other angles live (phase 4b)

*Agreed in principle 2026-11-05, not built.* Only the angle being shown follows choice changes
(`flush()` syncs the target stack); the others catch up when visited. So coming back to an angle
after a change always reloads it, and its snapshot is stale. Where memory allows, the visited
angles should instead stay in sync in the background, so a return is complete at once.

**Not the flat copy.** Snapshots stay as they are. A cover costs about a MiB and frees nothing by
itself: it only lets the outgoing layers be released if the budget needs the room. On desktop,
7860 and 7861 never release anything, and a cover over a complete stack is revealed at once.
Drawing two live pictures during a transition instead would look the same and cost a picture.

**One measure, not per-device rules.** What one picture costs in texture bytes already combines
the layer count, the image resolution, the box size and the pixel density. Measured once the
current picture is complete: the bytes of the textures its entries draw (`P`). The device comes
in through the budget (`B`). With `N` visited angles:

- **All live** while `P × N ≤ 0.75 × B`. After the current picture is complete, and after the
  hover preload, the other visited stacks are synced in the background (`sync_stack()`), two
  loads at a time like eager mode and before it, each load `wanted` only while all-live still
  holds. Synced stacks are not pinned; the budget still governs them.
- **Current behaviour** otherwise: only the shown angle follows changes, the others keep their
  snapshots and release layers as needed.
- **Hysteresis:** all-live stops as soon as `P × N > B` or an eviction releases a texture of a
  visited stack, and is only resumed below the 0.75 mark, so a product near the limit does not
  load and release the same images in turn. Checked after each complete picture, angle switch,
  resize (the budget changes below the mobile breakpoint) and choice change.

Expected: 7860 (~2 MiB a picture) all live everywhere; 7861 all live on desktop (30 MiB × 4
against 256), current behaviour on a phone (59 MiB × 4 against 96); 7859 current behaviour
everywhere.

**The cost to keep in mind:** every choice change then downloads and decodes for every visited
angle, not only the one shown: battery and data on phones, which is why the budget decides and
not the device class. The first picture always comes first: nothing syncs in the background while
the shown angle is loading.

**When not all views fit: refresh their snapshots when idle.** Waiting does not make memory:
bringing a hidden angle up to date by loading its stack means two pictures at once, the peak
snapshots removed from angle switches (and what crashed 7859 on the XS). What a hidden angle
needs is a correct snapshot, not a live stack, and a snapshot can be rebuilt a few images at a
time, the way capture works:

1. After a change has made the snapshot of a visited angle stale, and the configurator has been
   idle for 2 s, load one or two of that angle's images, built exactly as the live stack would
   build them (`fetch_texture()` at `texture_scale()`, same layout), so the live picture
   replaces the snapshot later without a visible change.
2. Draw them into a new render texture at the snapshot's size and the angle's layout, then
   destroy them at once.
3. Repeat in image order until every layer is drawn, then swap the new snapshot in.

Memory during a refresh: the picture on screen, plus two textures and one render texture, however
many layers the angle has. A layer cannot be patched in place (the layers above it cover it in a
flat image), so the whole angle is redrawn; its files usually come from the HTTP cache, so the
cost is decoding, not downloading.

- **Priority (prerequisite).** The decode queue is first come, first served today, so a refresh
  in progress would delay the images of a choice the customer just made. Background loads (this,
  eager mode, the all-live sync above) get a lower priority than loads for the picture being
  shown or coming, and a customer action jumps ahead of them.
- **Stopping.** Any choice change, hover preload or angle change stops the refresh (its loads are
  no longer `wanted`); the half-built texture is destroyed, and the refresh starts again after the
  next idle period.
- **Limits:** visited angles only; only angles whose snapshot is stale; each change refreshed at
  most once; the most recently visited angle first; nothing when the browser asks to save data
  (`navigator.connection.saveData`).
- **Not when one picture does not fit the budget** (`P > B`, 7859 on a phone): refreshing would
  mostly churn. There, coming back to an angle after a change reloads it, as now.

| Budget | Hidden visited angles |
| --- | --- |
| All fit (`P × N ≤ 0.75 × B`) | live, synced in the background |
| One picture fits (`P ≤ B`) | snapshots refreshed after 2 s idle |
| One picture does not fit | snapshots dropped when stale; reload on return |

**Open points:**

- *The thresholds* (0.75 to enter, 1 to leave): starting values, to adjust after a phone run.
- *The idle delay* for snapshot refreshes: 2 s to start with.
- *A device-aware budget:* `navigator.deviceMemory` where the browser has it (Chrome, Edge; not
  Safari or Firefox), e.g. ≤ 2 GB → 64 MiB, 4 GB → 96 MiB, ≥ 8 GB → 256 MiB, falling back to the
  breakpoint rule; the `PC.fe.viewer.canvas.texture_budget` filter keeps the last word.
- *Visited angles only, or every angle?* Syncing unvisited angles too would make the first visit
  of each instant, at the cost of loading pictures the customer may never look at. Recommended:
  visited only, with every angle as a later option (it is eager mode for angles).
- *Several views at once* (a grid of angles, live thumbnails) would need all live for real, with
  several stacks on screen. **Decided (Marc, 2026-11-06):** the same rule applies, live where it
  fits, snapshots where it does not. Likely only for custom projects, unless core generates live
  angle thumbnails; nothing is built for it now.

## Rendering

On demand, like the 3D viewer (`requestRender`): the Pixi ticker is stopped (`autoStart: false`),
and `request_render()` coalesces into one `requestAnimationFrame`. Model changes, texture loads,
resizes and add-on items call it. Transitions and fades run their own frame loop for their
duration, then stop. An idle configurator draws nothing.

**Angle transitions** (from the draft): `visibility` (default, parity with the stack), `fade`,
`slide-horizontal`, `slide-vertical`; filter `PC.fe.viewer.canvas.angle_transition`, 350 ms
(`PC.fe.viewer.canvas.angle_transition_duration`). Slides go forward or back by the angles' order.
They run between a snapshot cover and the incoming stack or its cover (above), so only one layered
picture is drawn live, except when the outgoing picture was incomplete and has no snapshot. A
transition ends on time even where frames do not run (a background tab), and a new angle change
finishes the running one first.
`prefers-reduced-motion` forces `visibility`. Swipe to change view keeps working unchanged: it is
bound to `.mkl_pc_layers`.

**Context loss.** Listen for `webglcontextlost` / `webglcontextrestored` on the canvas and fire the
same hooks as the 3D viewer (`PC.fe.viewer.context.lost`, `PC.fe.viewer.context.restored`). On
restore, redraw: Pixi re-uploads the textures from their images (checked on product 613: screen
and capture identical before the loss and after the restore). Not restored within 3 s: fall back
(table above).

**Teardown.** `remove()` stops loops, disconnects the `ResizeObserver`, ends waits, destroys
add-on items, destroys the viewer's textures (before the renderer, so their GPU copies are
released) and calls `app.destroy( { removeView: true }, { children: true } )`, which releases the
WebGL context. Checked: 25 remounts leave one canvas, one probe and no warnings.
Without it, reopening the configurator modal leaks a WebGL context per open; browsers keep about 16,
then drop the oldest - a blank viewer after enough opens.

## Custom HTML

Choices' `custom_html` renders as `viewer_layer_html` views, direct children of `.mkl_pc_layers`
after the canvas (as siblings, like in the stack, so theme rules still match), in image order, with
the `viewer_layer_html` visibility rules; a static layer's HTML is inserted as the stack does it.
Built in phase 2 rather than 4, so turning the canvas on never loses custom HTML. It therefore always sits **above** every image layer; it can
no longer sit between two of them. Accepted (decision D): a store that needs HTML between layers
keeps the `<img>` stack. Say so in the setting's description.

## Capture

`capture( options )` renders the current picture off screen at the requested size
(`{ width, height, maxDimension }`, default max `PC.fe.pdf.max_dimension`), reads it back with
`renderer.extract.pixels()` and resolves a PNG blob. It does not touch what the customer sees.

It does not reuse the on-screen textures, which are only as sharp as the box. Each image is loaded
again (from the HTTP cache), resized to the output size on a 2D canvas the way the stack's capture
resizes it, and drawn into one render texture six at a time, so memory stays at a few output-sized
images however many layers the picture has. Checked on 7860 (3840 px images captured at 1200,
20,400 semi-transparent pixels per picture): identical to the stack's capture on all 4 angles.

**Pixi 8.16 reads back premultiplied colour and does not convert it** (`extract.canvas()` and
`extract.pixels()` alike: a 200 grey at alpha 74 comes back as 58). Drawn as is, semi-transparent
edges came out up to 63/255 darker than on screen. `unpremultiply()` restores straight alpha; the
capture of product 613 is then pixel-identical to the `<img>` stack's capture (459,648 pixels, no
difference).

- What to draw: `get_capture_models()` / `PC.fe.viewer.capture.models`, as today.
- `PC.fe.viewer.capture.canvas( ctx, canvas, viewer )` still runs: the pixels are put on a 2D
  canvas first, so watermark and background hooks keep working.
- Waits for the picture's images to load; resolves `null` when one cannot be loaded, never a
  partial picture.
- No cross-origin failure mode: anything on screen was CORS-clean to get there.

## Cart and order images

Unchanged. 2D products still get the server-merged image; `accepts_3d_screenshot()` keeps refusing
posted screenshots for 2D products, and the canvas viewer does not post one. Text overlay keeps
sending its own PNG.

Flag for the image overlay spec, not solved here: a warped or shaded customer image cannot be
reproduced by `Images::merge()`. That feature will need either a canvas-viewer screenshot accepted
for 2D products that use it, or server-side compositing.

## Add-ons

`PC.fe.viewer.item.view` returns a Backbone view whose `$el` is inserted in the DOM; it keeps that
meaning and is not called by the canvas viewer. Canvas items get their own filter:

```js
/**
 * @param {Object|null} item    null, or an item factory
 * @param {Backbone.Model} choice
 * @param {Object} context      { viewer, layer, request_render }
 */
wp.hooks.addFilter( 'PC.fe.viewer.canvas.item', 'my-addon', function( item, choice, context ) {
	if ( 'text-overlay' !== choice.collection.layer_type ) return item;
	return {
		create: function( angle_id ) { /* return a PIXI.Container */ },
		set_angle: function( angle_id ) {},  // optional
		destroy: function() {},
	};
} );
```

- The viewer places the returned container in the choice node, so order, visibility and capture
  come for free. An item calls `context.request_render()` when it changes.
- An add-on that registers `PC.fe.viewer.item.view` for a layer and no `PC.fe.viewer.canvas.item`
  makes the product fall back to the `<img>` stack (table above). Existing text-overlay products
  keep working before text overlay is ported.
- The pool's `PC.fe.viewer.layer_is_pooled` does not apply; every choice is a node.

Not fired by the canvas viewer (DOM-only, documented): `PC.fe.viewer.item.tag`,
`PC.fe.viewer.item.view`, `PC.fe.viewer.layer.classes`, `PC.fe.viewer.layer.render`,
`PC.fe.viewer.layer.render.after`, `PC.fe.viewer.static_layer.*`, `PC.fe.choice-img.init`.
`PC.fe.viewer.html_item.added` fires with the HTML view. `PC.fe.viewer.item.added` waits for
phase 5: until there are canvas items there is nothing to pass that a listener expecting a view
could use (nothing listens to it today).

Known consumers to adjust:

| Consumer | Today | Change |
|---|---|---|
| Text overlay | DOM item view with its own Pixi app per choice | Canvas item: drops its own `Application`, adds a container. Phase 5 |
| Save your design | `capture_viewer_image()` first; `pdf_render_method === 'pixi'` and the html2canvas fallback scrape `.mkl_pc_layers` children | Route `pixi` to `capture_viewer_image()` when the viewer is canvas |
| `pc-fe-main.js` swipe | Binds to `.mkl_pc_layers` | None |
| `ev` theme | `PC.fe.viewer.render` hook | None |

## Admin

- Setting `viewer_2d_renderer` in the viewer settings section, with the CORS hint and the custom
  HTML limitation.
- No change to layer, choice or angle forms. The admin preview keeps the `<img>` stack for now.
- **Canvas-only features never switch the renderer themselves** (decision A). Setting one up while
  the renderer is `dom` shows an admin notice in its settings ("Image overlays need the Canvas
  viewer", with a link to the setting). The first such feature is the image overlay; the notice
  belongs to that spec, this one only provides `mkl_pc_viewer_2d_renderer` to check against.

## Performance

Measured against the stack, on desktop Chrome and an iPhone, on local copies of product 636
("Test large data": 155 layers, 4 angles, 4,711 choices). 636 itself can't be used: it hotlinks all
14,696 of its images from the customer's live site, so the canvas falls back on CORS there, and a
memory run would pull hundreds of megabytes from their server. The copies use local placeholders at
the real images' pixel size (3840×2160 WebP with alpha, 32 MiB each once decoded), which is enough,
since GPU memory depends on dimensions, not file content. Placeholders live under
`uploads/pc-stress/`: one coloured stripe per layer position, the colour set by the choice, so a
wrong stack or a missed swap is visible.

What is measured:

- time to first complete picture;
- choice swap (selection to new pixels), angle switch;
- GPU memory after visiting every angle (should plateau at the budget);
- idle CPU (should be zero frames drawn).

Three levels, with different bars:

1. **Realistic: product 7860, "Stress test: 636 with conditions"** (636's 112 conditions kept).
   Conditional logic hides 150 of the 155 layers at start, so the default picture draws 3 images: ~95 MiB
   at full size, under 2 MiB scaled to the drawing box. The risk here is not one picture but what the
   angle stacks keep after many swaps across 4 angles. Plus product 613 (real images on disk).
   **Accept** when the canvas viewer is no slower than the stack on first picture, faster on angle
   switch, GPU memory stays flat at the budget after many swaps on every angle, and the iPhone run
   survives visiting every angle twice.
2. **Heavy: product 7861, "Stress test: 30 layers"**, a copy of 7859 (no conditions) keeping 30 of
   its drawing layers, spread evenly so their stripes cover the picture, plus the group one sits in.
   Every picture draws 30 full-size 3840×2160 images: ~950 MiB at full size, 30 MiB of textures
   at a 1336 px modal on desktop, about 60 MiB on a phone (960×540 at resolution 2). That is
   within the 96 MiB mobile budget, so this is the level where the phone should hold the whole
   picture and still keep some of the other angles. It is the realistic upper end of a large
   product with oversized images. **Accept** as for the realistic level, on the iPhone included.
3. **Extreme: product 7859, "Stress test: 636 with local images"** (conditions removed on purpose).
   Every layer shows, so the first picture draws 150 full-size images: ~4.6 GiB of textures, held
   "only just" by desktop Chrome on the dev Mac in phase 2. No real product is expected to be
   this large. The `<img>` stack pays the same cost, since the browser decodes each image at full
   size; the canvas does better since phase 3 scales textures to the box (150 images in 148 MiB at a
   505 px box, against 4.6 GiB). **Accept** when it does not crash, on desktop or iPhone. Slow loading and reloads on
   angle switch are acceptable as long as the picture ends up right.

## Phasing

Each phase ships on its own; the setting stays `dom` by default throughout.

1. **Shared visible-state helper.** Extract it from the pool and `get_capture_models()`. No
   behaviour change. *Done 2026-11-04 on `canvas-viewer`*: `viewer-state.js`, with
   `__tests__/viewer-state.test.js` holding it to the replaced code on 2,000 random
   configurations (with and without conditional logic), plus a live comparison on product 613
   (301 pictures, 2,408 pool states, conditions applied after each selection, no mismatch).
2. **Viewer MVP behind the setting.** Init, fit, visibility, swaps without flash, angles
   (`visibility` transition), loading state and hooks, teardown, `capture()`, and every fallback in
   the table. *Done 2026-11-04*: `views/parts/viewer-canvas.js`, the setting and
   `mkl_pc_get_viewer_2d_renderer()`, Pixi enqueued only where used, custom HTML (moved up from
   phase 4) and context-loss restore (Pixi handles it). Tested on product 613 with text overlay's
   layer stubbed out: 60 random selections and angle switches drawn exactly as the models say,
   capture pixel-identical to the stack, the C, CORS and both context-loss paths, 25 remounts.
   `__tests__/viewer-canvas.test.js` covers selection, fallbacks and `unpremultiply()`.
   Still loads full-size images on small screens until phase 3.
3. **Textures.** Responsive URLs, lazy/eager modes, preload, budget and eviction. *Done
   2026-11-04* on desktop Chrome: textures scaled to the box (above); on 7859, two rounds of all 4
   angles held 255 MiB against the 256 MiB budget with every picture complete (about 5 s per
   angle switch, reloading what was released); below the mobile breakpoint the budget dropped to
   96 MiB and the other angles were released at once; a 2400 px viewport upgraded all 146
   textures in place. On 7860, 108 random swaps and 12 angle switches drew exactly what the
   models say (median 32 ms to new pixels, max 226 ms). Eager mode filled the budget in 14 s and
   stopped; a hover preload loaded without pinning or the loading state. Capture identical to the
   stack's on 613 and on 7860. 15 remounts released every texture; context restore redraws
   identically with bitmap sources. `__tests__/viewer-canvas.test.js` covers the scale steps,
   eviction order, the responsive pick and the budget. iPhone XS run done (below): 7860 and 7861
   stable, 7859 loads but crashes after a while of fast switching. **Still to run:** the timing
   comparison against the stack.
4. **Snapshots and transitions.** Snapshots (above), then angle transitions and fades on top of
   them. *Done 2026-11-05*, checked as described in the Snapshots section. Still to check: the
   iPhone, especially 7859, which crashed holding two pictures during switches.
4b. **Other angles live** where the budget allows, idle snapshot refreshes where it does not (section
    above). The decode-queue priority comes first.
5. **Add-ons.** `PC.fe.viewer.canvas.item`, text overlay port, Save your design route.
6. **Per-view order.** Rung 1 of the ladder and the restack flag, with phases 1 and 3 of the
   per-view spec (data and admin).

Then the image overlay spec.

**Prove on an iPhone (done 2026-11-05, iPhone XS):** Safari, 7860, many swaps and every angle visited twice, now
with the real budget and eviction instead of the crude stub this was planned with (it moved after
phase 3, which provides them). *First run, 2026-11-05, iPhone XS:* 7860 works well; 7859 dies
quickly. The likely cause is the first picture starting all 150 full-size decodes at once (32 MiB
each, several GB if they arrive together) rather than the textures (~300 MiB at resolution 2).
7861 died after a couple of seconds as well, so decodes are now capped (above). With the cap,
7861 holds on the XS (59 MiB after load; about 97 MiB of 96 MiB once angles were visited, the
pinned picture going over during an angle switch, as allowed). The same run surfaced a race: a
texture that had just resolved but had no sprite yet counted as unused, so another load's budget
check could release it and the sprite was built from a null texture. Entries waiting for a texture
now pin it (`waiting`, read by `is_pinned()`). For comparison, the `<img>` stack loads 7861 on the
XS but crashed during fast angle switching. With the cap, 7859 loads every image on the XS
(150 textures at 960×540, 2 MiB each). Choice changes and quick angle switches then crashed it
after a while; the last reading before that was 208 textures, 411 MiB, all pinned: the picture
on screen plus the incoming one, both held during the switch, against a 96 MiB budget (about
twice that in real memory with the bitmap sources). That double picture is what snapshots remove
(phase 4): pinned during a switch would be one picture, ~300 MiB, plus a 1.2 MiB snapshot. If 7859
still crashes after that, the next lever is releasing each texture's bitmap source once uploaded
(rebuilt from the URL on context restore), which roughly halves real memory. 7859 is the extreme
level, so a crash there does not block. 7861 with fast angle switching, the case that crashed
the `<img>` stack, is stable on the XS (with abandoned decodes, 9faff541): by hand, then with a console script making
300 random choice and angle changes 100 to 200 ms apart while Marc opened and closed layers - no
errors, 105 MiB at most, 89 MiB pinned at most, 95 MiB at the end. The iPhone part of the run is
done; the timing comparison against the stack remains. If memory cannot be held under budget without visible reloading on
angle switch, the angle-stack design changes (fewer cached angles, smaller textures on mobile)
before phase 4. `PC.fe.modal.viewer.texture_stats()` from Safari's Web Inspector gives the numbers.

## What to keep from the draft

From `viewer-pixi.js` on `origin/v2/add-canvas-view`:

- **Keep:** one container per angle, the transition code and its directions, contain-and-centre
  fitting, `ResizeObserver` sizing.
- **Rewrite for Pixi v8:** `new PIXI.Application( options )` → `await app.init()`; `app.view` →
  `app.canvas`; `Texture.from( url )` / `baseTexture.valid` / `'loaded'` events → a promise per
  image (`baseTexture` is a deprecated getter returning the `TextureSource`).
- **Bugs not to carry over:** unselected choices are never hidden (sprites are created visible and
  only angle visibility is toggled); `getContentBounds()` looks for textures on what are now angle
  containers; no teardown; `PC.fe.viewer.item.view` is not applied; responsive URLs and lazy loading
  were dropped; `this.layers` is an array used as a map.
- **Superseded by master since:** image pools and hold/swap, `layer_views` keyed by
  `layer_id:choice_id`, `insert_image()`/`sort_key()`, the viewer contract and `capture()`.

## Decisions

Answered by Marc, 2026-11-04.

- **A. Choosing the renderer:** global setting plus a filter. Per-product override only if asked
  for. Canvas-only features do not switch the renderer; they show a notice when set up under `dom`.
- **B. Default:** `dom` until phase 5 ships, then `canvas` for new installs only.
- **C. Layers with a DOM-only item view:** fall back to the `<img>` stack (below).
- **D. Custom HTML always on top:** accepted; stores that need otherwise keep the `<img>` stack.
- **E. Core.** Infrastructure, like the anchor placement engine; paid features sit on top.
- **F. Texture budget:** 256 MB / 96 MB as starting points, confirmed in phase 3.

### C in detail

When a visible layer's item comes from `PC.fe.viewer.item.view` (a DOM view) and nobody registered
a `PC.fe.viewer.canvas.item` for it. Today that is only text overlay, between phase 2 and its port in
phase 5, plus any store snippet using that filter.

- **Fall back** (specified): the product uses the `<img>` stack, console notice names the layer.
  Always correct; the canvas viewer simply doesn't run for that product until the add-on is ported.
- **Bridge:** the canvas viewer mounts the DOM view off-screen and uploads its `<canvas>` as a
  texture, re-uploading on every change. Works for text overlay, but costs a second WebGL context
  per text overlay, a texture upload per keystroke, reconciling its own scaling with the scene's,
  and depends on text overlay's internal markup. It cannot work at all for views that are not a
  canvas (a video, an iframe).

Decided: fall back.
