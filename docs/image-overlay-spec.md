# Image overlay: the customer's upload in the preview

Status: **draft 2026-11-10, not built.** Decided (Marc, 2026-11-10): it is an enhancement of
Form builder's upload field, on form layers **and** on choices of simple and multiple layers; the
zones and their masks sit on that field, and an upload without a zone mask takes the layer's;
form layers get no mask. B, C, D, F, G and I decided the same day; nothing open.

The customer uploads an image through a Form builder upload field. It shows in the configurator
preview, placed in a zone the admin draws on each view and cut to shape by a
[mask](layer-masks-spec.md): the one set on the field for that view, or else the layer's. The cart, quote and order pictures show it too, and the order keeps
the original file and its placement, so a print-ready picture can be made later.

**Why.** Custom prints (phone cases, mugs, shirts, watch dials, signs) are the most asked-for
feature the configurator does not have. Each request so far has been a custom plugin:
`buildyourwatch-upload-crop` (a Cropper.js dialog and a preview drawn over the dial) is one of
them. This is the general version, and the last step of the order agreed on 2026-11-09: canvas
viewer, layer masks, linked global layers with overrides, then this.

**Where it lives** (Marc, 2026-11-10): **in Form builder, as an option of the existing upload
field**, not a new add-on. Shops already using the upload field upgrade it to a live preview;
uploads keep the storage, order handling and download links they have today.

## In and out

In this step:

- An upload field gets **Show in the preview**: one zone per view, a rectangle with a rotation,
  cut by the zone's own mask, or else by the layer's.
- The customer places the image: fit, then move and zoom (decision C).
- Preview in the canvas viewer, every view.
- Cart, quote and order pictures, drawn by the server.
- The order keeps the original file (as today) and the placement.

Not in this step:

- **Shading and the STMap warp.** Kept in view (see [Later](#later-shading-and-the-stmap-warp)),
  not built: Marc, 2026-11-09.
- 3D products (the image as a decal or texture on a mesh).
- Collages, filters, background removal, text on the image (text overlay already does text).
- The full-resolution print job itself (the [masks spec](layer-masks-spec.md#later-full-resolution-output-for-printing)
  has it as a later step). This spec only keeps what that job needs.

## What exists

- **Form builder's upload field.** A field of type *File upload* (`text_field_type: upload`), in
  two places: a field of a **form layer** (each field is a choice), or the field attached to a
  **choice of a simple or multiple layer** (`has_text_field`, "Custom logo" with an upload). Its
  settings: accepted file types, additional mime types, maximum number of files. In the browser
  the field keeps the chosen `File` objects (`files` collection); they are posted with
  add-to-cart (`$_FILES['mklpc_upload_{layer}_{choice}']`), handled at
  `mkl_pc/wc_cart_add_item_data/adding_choice` into a protected temporary folder, moved to the
  order's folder when the order is placed, cleaned up daily when abandoned, with download links
  in the admin order. Quote requests have their own path (`quote-uploads.php`).
- **The canvas viewer's item hook**, `PC.fe.viewer.canvas.item` ([canvas-viewer-spec.md](canvas-viewer-spec.md),
  Add-ons): an add-on draws into the viewer's own scene, per choice and view; the viewer handles
  placement in the stack, captures and refreshes. Text overlay uses it.
- **Text overlay's zones**: per choice and view, `text_positions` holds a reference image
  (`ref_image: { url, width, height }`, the view's image the zone was drawn on) and a rectangle
  `position: { x, y, width, height, rotation }` in that image's pixels, with an admin editor that
  draws it on the reference image. An image zone is the same shape.
- **Layer masks** in all three renderers and the server merge: the file format (an alpha PNG the
  size of the view's images), the admin picker (`views/layer-masks.js`), the canvas encoding
  (`whiten()`) and the server's `Images::apply_mask()` / `mask_gd()` (public). The upload's masks
  reuse all of it; they are not layer masks.
- **The server merge's layer hooks**, used by text overlay for its PNG:
  `mkl_pc/cart_item/merge_layer_image_id` gives a layer's token in the merge list,
  `mkl-pc-serve-image-process-layer-image` the file behind a token.
- **Decided for this spec** (canvas viewer spec, "Should the browser send the whole picture?"):
  the server-merged picture stays the default for 2D; a browser picture only for layers the server
  cannot draw.

Gap found while writing this: an add-on item is cut by its layer's mask on screen, but the
snapshot refresh and `capture()` drew items uncut, so text overlay on a masked layer was cut in
the preview and not in the captured picture. And an item could not ask for another mask than its
layer's. Phase 1 adds `mask( angle_id )` to the item contract (canvas-viewer-spec.md, Add-ons):
the upload's item returns its zone's mask, or `undefined` for the layer's; the same mask applies
on screen, in refreshes and in captures.

## Admin

On an upload field, a **Preview** section:

- **Show the image in the preview** (off by default: existing fields do not change).
- **Zones**, one per view, drawn on the view's reference image with core's zone editor
  (`image_zones`: `[ { angleId, ref_image: { url, id, width, height }, position: { x, y, width,
  height, rotation } } ]`, the shape of text overlay's positions: `x, y` is the zone's top centre,
  and it turns around that point). A view without a zone does not show the image.
- **Zone masks**, one optional mask per view, kept as their own list on the field's choice,
  `zone_masks`, shaped exactly like a layer's `masks` (`[ { angleId, image: { id, url,
  dimensions } } ]`), so core's mask picker (`PC.views.mask_picker` with `attribute:
  'zone_masks'`) and the existing sanitising of that shape apply as they are.
- **The mask** follows the layer masks' rules: an alpha PNG the size of the view's images (checked
  against the zone's reference image, with the same size warning), opaque where the image may
  show. It is drawn aligned with the view, not with the zone, so the zone rectangle says where the
  image is placed and the mask says what of it shows: a mug's printable area, a phone case's
  camera hole. The size warning compares the mask with the zone's reference image.
- **Fit**: *Cover* (fill the zone, crop the overflow; default) or *Contain* (whole image, may
  leave space).
- **The customer may move and zoom** the image (decision C), on by default; a field setting turns
  it off, leaving the fit only.
- **Minimum size** (optional): the image's pixels across the zone's width below which the
  customer is warned that it may print blurry. Off by default.

The zone editor is text overlay's (open point I: where it lives so both add-ons use it).

### Form layers and choices of simple and multiple layers

The preview works on both places the upload field lives (Marc, 2026-11-10). The common case is
the second one: an **Artwork** layer offers preset artworks on a part of the product, and one of
its choices, *Upload your own*, carries an upload field. The upload replaces the artwork in the
same area. Limiting the preview to form layers would need a conditional logic rule to show a form
layer when *Upload your own* is picked: the customer would choose in one place and upload in
another, and the shop would place the form layer where the artwork goes in the image order.

- **On a choice of a simple or multiple layer**, the image shows while that choice is selected,
  as any choice does (the item hook is per choice, and the viewer draws selected choices only).
  Before a file is chosen, the choice's own images show: a placeholder.
- **In a form layer**, the field is a choice of its own; the image shows once a file is chosen.
  Form fields are never selected, so Form builder adds them to the drawn choices through core's
  `PC.fe.viewer.shown_choices` filter (canvas viewer only).
- **Only fields drawn in the configurator** (Marc, 2026-11-10): a quote request form layer showing
  its fields in the request window gets no preview, and its Preview section says so.

### Masks

**Which mask cuts the upload, per view: the zone's own mask if it has one, else the layer's.**

- **Form layers get no mask** (Marc, 2026-11-10): the layer Mask section stays on simple and
  multiple layers only, as today. A form layer's uploads are cut by their zones' masks only, and
  two upload fields in one form layer each have their own.
- **On a simple or multiple layer**, an upload without a zone mask is cut by the layer's mask,
  like the layer's other choices: the Artwork layer's mask already says where artwork goes, so
  *Upload your own* needs no mask of its own. A zone mask is for when the upload needs another
  shape than the presets (a smaller printable area); it then replaces the layer's for that view.
- **New zones start on the mask**: when the layer has a mask on that view, a new zone starts as
  the box around the mask's opaque pixels, so on an Artwork layer it already covers the print
  area. The admin adjusts from there.

**Zones and zone masks are choice data**: a layer made global and linked several times shares
them on every link (choices are not overridden per link, [global-layer-overrides-spec.md](global-layer-overrides-spec.md)).
The layer's mask can be overridden per link, so an upload without a zone mask follows each link's
area: one global Artwork layer linked on the front and the back, each link with its own mask,
cuts the upload right on both.

**Accepted types.** The preview only draws JPEG, PNG and WebP (and GIF, first frame). A field that
also accepts PDF or Illustrator files keeps doing so; those files show no preview. The Preview
section says so when the accepted types allow others.

When the 2D viewer setting is the `<img>` stack, the Preview section shows the notice the canvas
spec reserved: "The preview needs the Canvas viewer", with a link to the setting.

## Front end

### Choosing the file

The field works as today (button, drop area, the list of files). With the preview on:

- **The preview is decoded at a capped size**, never at full size: `createImageBitmap()` on the
  `File`, with `resizeWidth`/`resizeHeight` to the zone's largest on-screen size × device pixel
  ratio, at most 2048 px. A 12-megapixel phone photo decoded whole is the decode load that crashed
  the iPhone XS (canvas spec, Textures).
- **Orientation**: `imageOrientation: 'from-image'`, so a portrait photo stands up. The server
  does the same from EXIF (GD does not on its own).
- **HEIC**: iOS Safari hands a JPEG to a file input whose `accept` names JPEG; to verify on an
  iPhone, with Form builder's `accept` built from the accepted types.
- Only on fields accepting one file (decision G).
- Nothing is sent before add-to-cart, as today (decision B).

### Drawing

A canvas item (`PC.fe.viewer.canvas.item`) per field and viewer. For each view with a zone, it
draws the bitmap in the zone's rectangle: centred, fitted (cover or contain), then the customer's
placement, clipped to the rectangle, and cut by the zone's mask or else the layer's (core's mask
texture loading and encoding, applied to the item's container: the item is masked on its own,
whatever the layer's other images do). Before an upload it draws nothing;
the choice's own images, if any, show (a placeholder, a frame).

### Placing

**The placement** is kept relative to the zone, so the same placement fits every view whatever
the zone's size there (one placement for every view; one per view can be added later as a field
setting):

```json
"placement": { "x": 0.12, "y": -0.05, "scale": 1.4, "rotation": 0 }
```

`x` and `y`: the image centre's offset from the zone centre, in zone widths and heights; `scale`:
relative to the fit; `rotation`: degrees, on top of the zone's.

With adjustments allowed (decision C): drag the image in the preview to move it, scroll or pinch
to zoom, a **Reset** button by the field back to the fit. The item takes pointer events only inside
its zone, on the view on screen; elsewhere the viewer behaves as usual. Keyboard: arrow keys move,
+ and − zoom, while the image's handle has focus.

### What the configuration holds

The field's choice gains `placement` in the configuration, next to its `field_value` (the file
names) and, once on the server, `files`. A saved configuration also keeps the zone it was placed
in and the fit, so an admin moving the zone later does not move the image of past orders (choice
resolves live, not stored: the same reason the order keeps `mask`).

## Cart, quote and order pictures

**The server draws the layer**, at add-to-cart, when Form builder has handled the file: from the
uploaded file, the placement, the zone and the mask that applies (the zone's, else the layer's
for that view, through `Images::apply_mask()`), it composes a PNG the size of the view's reference
image (scaled, rotated, clipped to the zone, masked), and stores it under a token made from all of
those (`u…`, never digits only, so it cannot clash with image or mask ids), in the configuration
image folders, as text overlay does with its PNG. The two merge hooks put it in the merged picture
like any layer image. So:

- the cart, quote and order pictures need no picture from the browser: the server can draw this
  layer, which keeps the 2026-11-09 decision (a browser picture only for what the server cannot
  draw: the warp, later);
- the picture can be redrawn at any size, after an admin edits the order, and by the Fix images
  tool, as long as the file is there;
- full resolution for printing is the same composition from the original, at the full size of
  the view's images: no browser needed while there is no warp.

Details:

- **The token does not depend on where the file is**, only on its content, the placement, the
  zone and the mask that applies (by id): moving the file into the order's folder keeps the composed picture valid.
- **Decoding is guarded**: `getimagesize()` first, and no composition above a pixel limit (a
  50-megapixel photo is about 200 MB in GD). Over the limit, the picture is made without the
  upload, and the order still has the file. The limit is a filter; default to measure in phase 3.
- **Quote requests** compose the same way when `quote-uploads.php` accepts the file.
- **Cost**: one affine draw and one mask pass at the reference size per view, the first time;
  stored after. To measure against the GD numbers of the masks spec.

**The order** shows the composed picture as usual, and the download link Form builder already
adds. The admin configuration editor loads the file back from the order's folder, so an admin
can move the image and save.

## Later: shading and the STMap warp

Not built now (Marc, 2026-11-09). What they are, so nothing here blocks them:

- **Shading**: a light map per view (the folds of a shirt, the gloss of a mug) multiplied or
  screened over the customer's image. The zone gains an optional `shading` image per view.
- **STMap warp**: per view, an image whose red and green channels give, for each pixel of the
  view, where to read the customer's image (a UV map), baked from a 3D placement mesh. Bends the
  image around a mug or a cap. The zone gains an optional `stmap` image per view; the canvas item
  draws through a Pixi filter or a mesh instead of a sprite.
- **The server cannot draw a warped image** with GD (canvas spec, Cart and order images). With
  either feature on, the cart picture comes from the browser for that layer: the posted-picture
  path the canvas spec describes (accepted when the server-built configuration contains such a
  layer, mobile image size for the capture). The print picture comes from the admin editor's
  off-screen `capture( { width, height } )`. Both need the original and the placement, which this
  step already keeps.

## Not in this step

- 3D. Text overlay draws on 3D through its own texture path (`overlay-viewer-3d.js`); an image on
  a mesh is a decal or a texture swap, its own spec.
- The `<img>` stack (decision D).
- Sending the file before add-to-cart (decision B).
- Fields accepting several files (decision G).

## Phasing

1. **Core.** `mask()` on canvas items (the gap above); the mask picker usable on any model
   and list (`PC.views.mask_picker`); the zone editor (`PC.views.zone_editor`, views/zone-editor.js:
   reference image, drag to move, handles to resize in the zone's turned frame, number fields,
   the mask shown faintly, a new zone starting on the mask's opaque box, a `decorate()` hook for a
   preview inside the zone). Text overlay moving onto it is its own later step.
2. **Form builder admin.** The Preview section, its settings, zones, the canvas-viewer notice.
3. **Form builder front end.** Capped decode, the canvas item, placement and its controls, the
   placement in the configuration. Jest for the placement maths; iPhone run with a full-size phone
   photo.
4. **Server pictures.** Composition at add-to-cart and in quote requests, the token and the merge
   hooks, the pixel limit, the admin editor reload. PHP suite comparing the composed layer with
   the preview's capture.
5. **Docs**: the upload field's page gains the preview.

## Decisions

Marc, 2026-11-10, with A, E and H (where it lives, the original, zones on the field) above.

- **B. When the file is sent: at add-to-cart, as today.** Nothing changes for
  existing shops, and the server has the file when it draws the cart picture. What this leaves
  out: Save your design and share links (a saved design would show the field without its image),
  and the admin editor creating a quote for a lead from scratch. Sending the file as soon as it is
  chosen, to temporary storage, would cover them; a later step if they are asked for.
- **C. What the customer may adjust: move and zoom.** Rotation is not offered; a field setting
  can turn adjusting off (the fit only).
- **D. The `<img>` stack: canvas only.** With the stack (the setting, or a fallback:
  no WebGL, CORS), the field works as today, the preview does not show the image, and the cart
  picture is still right (the server draws it). The other option, a 2D `<canvas>` element in the
  stack drawing the same thing, doubles the drawing code for a setting the notice already steers
  away from.
- **G. Fields accepting several files get no preview** (Marc). The Preview section only shows on
  an upload field whose maximum number of files is 1; raising the maximum on a field with the
  preview on turns the preview off, and the section says why.

- **F. Limits: no new admin settings.** The field's accepted types and number stay as they are. The
  composition's pixel limit is a filter (above). The upload size stays PHP's.
- **I. The zone editor moves into core.** It is text overlay's today, and Form builder cannot depend on
  text overlay. It becomes a generic "zone on a view" editor in core that both
  add-ons use: one editor to maintain, and core already owns views and their images.

Earlier points closed by the Form builder decision: A (where it lives), E (the original is kept as
Form builder keeps it today), H (zones are on the field).

## Related

- [`canvas-viewer-spec.md`](canvas-viewer-spec.md): the item hook, the decision on browser
  pictures, the admin notice.
- [`layer-masks-spec.md`](layer-masks-spec.md): the mask, and full-resolution output for printing.
- [`global-layer-overrides-spec.md`](global-layer-overrides-spec.md): zones and their masks are
  choice data and stay shared across links.
- Form builder add-on: `upload-handling.php`, `quote-uploads.php`, `admin.php` (upload settings),
  `assets/js/scripts.js` (the field view, `on_change_file`).
- Text overlay add-on: zones (`text_positions`) and their editor, `Overlay_Canvas_Item`.
