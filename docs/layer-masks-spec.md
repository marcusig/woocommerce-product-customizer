# Layer masks (2D)

Status: **specified 2026-11-09, not built.** Decisions 1, 2 and 4 to 7 below are Marc's
(2026-11-09); nothing is open.

A layer can have a **mask per angle**: an alpha PNG that hides the parts of the layer's images
outside a shape. It is a core feature, drawn the same way by the canvas viewer, the `<img>` stack
and the server merge (cart, quote and order pictures).

**Why.** Two needs, one feature:

- **Shared images, several areas.** A shirt designer configures collar, sleeves and body
  separately, and every area uses the same fabric images: a render of the whole shirt in each
  fabric. Each area is a layer showing the fabric image through its own mask. That costs
  fabrics × angles images plus areas × angles masks, instead of fabrics × areas × angles images
  (about 1,600 for the 135-fabric shop in [shared fabric lists](#related)).
- **The image upload preview.** The customer's image is cut to the shape of its print zone. The
  image overlay spec reuses this mask instead of inventing its own.

## Decisions

1. **One mask per layer per angle, alpha PNG** (Marc, 2026-11-09). Transparent where the layer must
   not show, opaque where it shows, partly transparent for soft edges. Colour is ignored.
2. **Core, in all three: canvas viewer, `<img>` stack, server merge** (Marc, 2026-11-09), "if it
   can be done reliably on the img stack viewer". It can, under the conditions in
   [The `<img>` stack](#the-img-stack); they are the same rules the canvas already has, plus the
   mask's size.
3. Choices, groups and the configurator type are not involved. A group's mask clipping all of its
   layers, a mask per choice, and an inverse mask are left out until someone needs them.
4. **Using one global layer several times, each with its own mask, is its own step** (Marc,
   2026-11-09), after this one. The mask is an ordinary layer field, so a global layer carries
   its own mask today; a different mask per link is that step's work (it is the layer-level
   override in the shared fabric lists proposal).
5. **Field shape: a list mirroring a choice's `images`** (Marc, 2026-11-09, was open point A), so
   the admin pickers and the import code are reused.
6. **A mask that cannot load shows the layer unmasked** (Marc, 2026-11-09, was open point B):
   "easier to debug than something missing". Same in all three places, with a console line (or a
   PHP log line) naming the mask.
7. **Each image is masked on its own, in all three places** (Marc, 2026-11-09, was open point C).
   In the canvas viewer a layer node composites its sprites, so one mask on the node would be
   cheaper, but the `<img>` stack has no element per layer to mask and the server merge flattens
   images as it goes; masking each image is what all three can do alike. A layer showing one image
   (simple, static) keeps the single node mask, which is the same thing there.

## What a mask is

- A layer field `masks`, shaped like a choice's `images` (decision 5): one entry per angle,
  `{ angleId, image: { id, url, dimensions } }`. An angle without an entry draws the layer
  unmasked.
- Applies to **every image the layer draws on that angle**: the selected choice of a simple layer,
  each selected choice of a multiple-choice layer, the image of a static layer. Each image is
  masked on its own (see [Same picture everywhere](#same-picture-everywhere)).
- **2D only.** The section is hidden on 3D configurators, and a 3D product ignores the field.
- Only layers that draw images: simple, multiple and static layers. Not groups (they draw
  nothing), not form or text-overlay layers.
- **Same size as the layer's images on that angle.** The `<img>` stack stretches the mask over the
  image's box, the canvas and the server centre it at its natural size; with equal sizes all three
  agree. The admin warns when a choice image of the layer has another size than the angle's mask
  (see [Admin](#admin)).

## Same picture everywhere

The three places must produce the same pixels, so the rule is written once:

- **Alpha only.** The drawn alpha is the image's alpha × the mask's alpha. Colour channels of the
  mask are ignored.
- **Each image on its own,** then the images are stacked as today. Masking the layer's composite
  instead gives a different result at soft mask edges where two of the layer's images overlap
  (at a mask alpha of 0.5 over two opaque images: 0.75 per image, 0.5 on the composite), and the
  `<img>` stack can only mask per image.
- **Placement:** the mask covers the image exactly (same size, same position).

Pixi reads its sprite mask from the mask's **red channel** times its alpha (`a = alphaMul *
masky.r` in Pixi 8.16's mask filter), not from alpha alone, so a black alpha mask would hide
everything there. The canvas viewer makes each mask texture white-with-alpha when it builds it
(below); the files stay plain alpha PNGs.

## The `<img>` stack

CSS masks, on each `<img>` of the layer:

```css
mask-image: url( mask.png );          -webkit-mask-image: url( mask.png );
mask-size: contain;                   -webkit-mask-size: contain;
mask-position: center;                -webkit-mask-position: center;
mask-repeat: no-repeat;               -webkit-mask-repeat: no-repeat;
```

Both spellings, because Safari only takes the unprefixed ones from 15.4. Set inline by the layer
views, per angle (the mask changes with the angle, like the image's `src`), with the image pools
(`viewer_active_images_only`) and without, and on static layers.

**Why this is reliable**, and its conditions:

- **The mask lines up with the image.** Every core theme draws a layer image centred, with
  `max-width` and `max-height: 100%` and automatic width and height, so the `<img>` box *is* the
  drawn image, and `contain` + `center` lays a mask of the same proportions exactly over it. That
  also holds when a theme uses `object-fit: contain`. It breaks under `object-fit: cover` or a
  theme stretching images to a box of other proportions; documented, as the canvas setting
  documents its own CSS limits.
- **No unmasked flash.** How a browser draws an element whose mask has not loaded yet is not
  something to rely on, and an unmasked full-shirt fabric would paint over the whole product for a
  moment. So each angle's mask is loaded and decoded (`new Image()`, `crossOrigin = 'anonymous'`,
  `decode()`) before the layer's images of that angle are shown, and counts in the viewer's
  loading state like an image.
- **CORS.** Chrome and Firefox fetch CSS mask images in CORS mode, and a failed mask image hides
  the element. A mask on another domain therefore needs CORS headers, as images do for the canvas.
  The preload above uses the same mode, so it fails the same way and the viewer knows.
- **A mask that cannot load leaves its layer unmasked** (decision 6), and the console names the
  URL. Because a failed CSS mask *hides* the element, the mask style is only set once the preload
  succeeded; on failure it is never set.
- **Capture.** `drawImage()` ignores CSS, so `capture()` masks the layer itself: each of the
  layer's images is drawn on a scratch canvas, the mask is drawn over it with
  `globalCompositeOperation = 'destination-in'`, and the result is stacked as today. A mask that
  taints the canvas (cross-origin without CORS) makes `capture()` resolve null, as an image does.

## The canvas viewer

- **Textures.** A mask is loaded as a texture of the viewer: `load_texture()`, the budget, the
  scale steps, eviction and pinning (the stack showing it pins it). When it is built, its colour
  is set to white keeping its alpha (one 2D-canvas pass, `source-in` fill, at the downscaled size
  the texture is built at anyway).
- **Drawing** (decision 7). On a layer showing one image (simple and static layers, the common
  case), the layer node gets `node.mask = sprite`, the sprite placed like the layer's images. On a
  layer showing several (multiple choice), each sprite gets its own mask sprite, so the rule above
  holds; held images during a swap are covered by the same rule.
- **Loading.** An entry of a masked layer is not settled until the mask texture is ready or has
  failed, so the picture does not flash the layer unmasked while its mask loads. A failed mask
  draws the layer unmasked (decision 6) and logs the URL; unlike a failed image, it does not make
  the viewer fall back to the `<img>` stack, which would draw it unmasked too.
- **Snapshots.** `picture_key()` includes each layer's mask URL for the angle, so a mask change
  makes snapshots stale; the idle refresh and `capture()` draw masked layers with the same rule
  (each in a container with its mask, at the capture's scale).
- **Add-on items** in a masked layer are inside the node and masked with it. Not a goal (text
  overlay layers have no mask section), just what happens.

## The server merge

- `Images::merge()` takes, per image, an optional mask path. A masked image is resized to the
  output size first (with its mask), then masked, then inserted. Masking at the output size is
  what keeps GD usable.
- **Not Intervention's `mask()`.** Its GD driver redraws pixel by pixel through Intervention's
  colour objects and rounds alpha to two decimals. Our own routine instead:
  - **Imagick:** `compositeImage( $mask, Imagick::COMPOSITE_DSTIN, 0, 0 )`.
  - **GD:** one pass with `imagecolorat()` / `imagesetpixel()` on the alpha only. Measured on
    Local's PHP 8.5 (no Imagick in any Local PHP build): **1.17 s at 3840×2160, 0.11 s at
    1200×675** per masked image. Merged files are cached on disk and shared by identical
    configurations, so a full-size merge pays it once.
- **File name.** `product_<id>-conf-<imageIds>` gains each masked layer's mask id, so changing a
  mask produces a new file instead of serving the old picture.
- **One-image stacks.** A configuration whose stack is one image is shown as that attachment
  today, unmerged. With a mask on it, it has to be merged.
- The REST on-the-fly merge and the Fix images tool go through the same path.
- A mask file that is missing or unreadable merges the image unmasked (decision 6) and logs it.

## Saved configurations

Past orders must keep their picture when a layer's mask changes later
([choice resolves live, not stored](#related)). `save-data.js` writes the layer's mask id for the
cart angle into each choice's `layer_data` (`mask`), next to `image`, and the server prefers the
saved one when `Choice::is_stored()`, as `get_image_id()` does for `image`.

## Admin

- New layer section **Mask**, shown for 2D configurators and image layers, after Selection
  settings (Marc, 2026-11-09). One picker per angle, modelled on the choice form's per-angle picture
  (`PC.views.choice_picture` in `admin/js/views/choices.js`); layer settings have no image field
  type today.
- **Size check.** Next to each angle's mask, a warning when one of the layer's choice images on
  that angle has another size than the mask ("3 images are 2000×2000, the mask is 1800×1800").
- **Previews.** The admin previews that draw layers (Image order) apply the mask the way the
  `<img>` stack does, so the admin sees what customers see.
- Import, export and the global layer Linker carry `masks` like any layer field; nothing to
  convert.

## Phasing

1. **Data and admin.** The `masks` field, the Mask section and its size check, import/export.
2. **Server merge.** The routine (Imagick and GD), the file name, one-image stacks, saved masks.
   Checked against a product with masked layers: the merged picture against a reference composed
   by hand, and the GD timing at full size.
3. **`<img>` stack.** CSS masks, preload and loading state, failure, capture; Image order preview.
4. **Canvas viewer.** Mask textures, node and per-sprite masks, loading, snapshots, capture.
   Checked: canvas, stack and server pictures of the same configurations compared pixel by
   pixel (they must match, within rounding), Safari on the iPhone.
5. **Docs.** A user page (masks, sizes, CORS, the theme condition), and the hooks.

Phase 2 can ship before 3 and 4 only if the viewers already ignore the field safely; simplest is
to ship 1-4 together.

## Later: full-resolution output for printing

Marc, 2026-11-09: a store printing products needs the whole configuration merged at **full
resolution**, on demand from the admin (an order item action, say), without the viewer or the
storefront paying for it. Not part of this work, but nothing here may block it:

- **The server merge masks correctly at any size.** Masking after resizing is only a shortcut when
  the output is smaller; at full size the mask is applied at full size (1.17 s per masked
  3840×2160 image on GD). An on-demand admin job can afford that; it should run outside the page
  request (Action Scheduler, which WooCommerce ships), since a dozen masked layers is more than a
  typical PHP time limit wants in one request.
- **Masks are stored at full size.** Only viewers downscale them, as textures or by the browser;
  no smaller copy replaces the original.
- **The order keeps what it needs to redo the picture:** the mask id per layer (Saved
  configurations, above), as `image` already does.
- **Text overlay** is already ready: its cart PNG is drawn at the reference image's size, which is
  the layer images' full size, from text, font and colour that the order also keeps.
- **The image overlay is the hard case.** A warped or shaded customer image cannot be redone by
  the server merge (canvas viewer spec, Cart and order images), so a print-resolution picture of it
  has to be drawn by a browser: the admin configuration editor rendering off screen with the canvas
  viewer's `capture( { width, height } )`, which draws at any size without touching what is on
  screen, up to the GPU's maximum texture size (commonly 8192 or 16384 px). For that, the order
  must keep the customer's **original upload and its placement and transform**, not only a
  preview picture. The image overlay spec has to plan for it.

## Open points

None: A, B and C became decisions 5, 6 and 7.

## Related

- [`canvas-viewer-spec.md`](canvas-viewer-spec.md): the viewer this builds on; the image overlay
  comes after both.
- Shared fabric lists: linked global layers with local overrides, proposed 2026-11-06 and now
  reduced by masks to layer-level overrides (name, mask, 3D target). Decision 4.
- Choice resolves live, not stored: why saved configurations keep their own `image`, and now
  `mask`.
