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
    angle_stack[angle_id]   ← one per angle that has been shown; only the active one (and the
      layer_node[layer_id]     outgoing one during a transition) is visible
        choice_node[layer_id:choice_id]
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

**Which URL.** Port the responsive pick from `viewer_layer.render()`: `url_mobile` below
`mobile_image_breakpoint`, `url_large` at or above `large_image_breakpoint`, based on the viewer
width. Re-picked when a resize crosses a breakpoint.

**When.** `image_loading_mode`:

- `lazy` (default): load what the current picture needs; preload on the choice's `preload-image`
  event (hover), as the pool does.
- otherwise: after the current picture is complete, load every image of the active angle in the
  background, within the budget.

**Memory budget.** This is the risk the `<img>` stack never had: the browser evicts decoded images
under pressure, while every GPU texture stays until it is destroyed. Choices × angles × full-size
images exhausts mobile Safari.

- Budget in bytes (`width × height × 4`), filter `PC.fe.viewer.canvas.texture_budget`. Defaults:
  256 MB, 96 MB when the viewer is under `mobile_image_breakpoint` (decision F); confirmed or
  adjusted by the phase 3 measurements.
- Textures used by the visible picture, and by the outgoing picture during a transition, are
  pinned. Everything else is least-recently-used and destroyed when over budget.
- Preloads and background loads never evict pinned textures, and stop when they would exceed the
  budget.
- The viewer owns what it loads; add-on items own and destroy their own textures.

**Loading state.** `is-loading-image` on the root, `PC.fe.viewer.layer.preload.complete` per item
and `PC.fe.viewer.layers.preload.complete` when the current picture is complete - the names the
stack fires, counted per *picture*, so a background load never holds the loading class.

## Rendering

On demand, like the 3D viewer (`requestRender`): the Pixi ticker is stopped (`autoStart: false`),
and `request_render()` coalesces into one `requestAnimationFrame`. Model changes, texture loads,
resizes and add-on items call it. Transitions and fades run their own frame loop for their
duration, then stop. An idle configurator draws nothing.

**Angle transitions** (from the draft): `visibility` (default, parity with the stack), `fade`,
`slide-horizontal`, `slide-vertical`; filter `PC.fe.viewer.canvas.angle_transition`, 350 ms.
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

Measured on a large stress product and on product 613 (real images on disk), against the stack,
on desktop Chrome and an iPhone. The stress product is a copy of 636 ("Test large data": 155 layers,
4 angles, 4,711 choices) with its images served locally: 636 hotlinks all 14,696 of its images from
the customer's live site, so the canvas would fall back on CORS there, and a memory run would pull
hundreds of megabytes from their server. Local placeholders at the real images' pixel sizes are
enough, since GPU memory depends on dimensions, not file content.


- time to first complete picture;
- choice swap (selection to new pixels), angle switch;
- GPU memory after visiting every angle (should plateau at the budget);
- idle CPU (should be zero frames drawn).

Accept when the canvas viewer is no slower than the stack on first picture, faster on angle switch,
and the iPhone run survives visiting every angle twice.

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
3. **Textures.** Responsive URLs, lazy/eager modes, preload, budget and eviction. Performance run.
4. **Polish.** Angle transitions and fades.
5. **Add-ons.** `PC.fe.viewer.canvas.item`, text overlay port, Save your design route.
6. **Per-view order.** Rung 1 of the ladder and the restack flag, with phases 1 and 3 of the
   per-view spec (data and admin).

Then the image overlay spec.

**Prove first (before phase 3; it needs the phase 2 viewer to run):** iPhone Safari, the stress product, every angle visited twice, with
eviction stubbed in crudely. If memory cannot be held under budget without visible reloading on
angle switch, the angle-stack design changes (fewer cached angles, smaller textures on mobile)
before anything else is built on it.

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
