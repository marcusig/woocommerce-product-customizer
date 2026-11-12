# Solid-colour choices (2D)

Status: **specified 2026-11-12, not built.** Decisions 1 to 7 are Marc's (2026-11-12); nothing is
open.

A layer can draw its choices' **colour** instead of an image: the choice's existing "Color hex
code" fills the layer's area, cut by the layer's mask for that angle. One colour list then covers
any number of areas with no images at all, only a mask per area and angle.

**Why.** A customer asked whether the colour can colour elements in the viewer. With
[layer masks](layer-masks-spec.md) the mask already says *where* a layer draws, so a colour only
changes *what* fills it. Today the hex code is drawn as the swatch in the choices list and nowhere
else.

## Decisions

1. **The source is the choice's "Color hex code"** (`color`, Marc, 2026-11-12). A colour picker for
   customers is a later step, kept in [Later: a colour picker](#later-a-colour-picker) so nothing
   here blocks it.
2. **In the `<img>` stack, an `<img>` whose `src` is an SVG data URL** (Marc, 2026-11-12): one
   `<rect>` filling a `viewBox` the size of the mask. Discussed and compared:
   - *A PNG generated at the mask's size* (canvas → blob URL): a decoded bitmap of width × height ×
     4 bytes, about 33 MB at 3840×2160, as much again as the mask it is drawn under. Rejected.
   - *An inline `<svg>` element*: vector too, takes a CSS mask, and a colour change is one `fill`
     attribute. But every core theme sizes, centres and fades layers by tag (`img` with
     `max-width/max-height: 100%`, `width/height: auto`, the centring transform, `.active` /
     `.loading`), and the mask only lines up because the drawn box is the image box. An `<svg>`
     would need those rules copied into every theme, and child-theme CSS aimed at `img` would miss
     it.
   - *SVG in an `<img>`* keeps the vector (the browser rasterises it at the size it is shown, no
     full-size bitmap) and is an `<img>`: theme CSS, `set_src()`, the loading count and image
     pools all work as they are. A colour change is a new `src`, which goes through the normal
     loading flow.
3. **Same rule in all three places**, as for masks: canvas viewer, `<img>` stack, server merge.
4. **An image on the angle wins over the colour** (Marc, 2026-11-12, was open point A). A setting
   "colour replaces images" for layers whose choices have both is added only if someone needs it.
5. **Only `#rgb` and `#rrggbb` are drawn** (Marc, 2026-11-12, was open point B). The field stays
   free text for the swatch, which accepts any CSS colour; anything else (`red`, `rgb(…)`,
   gradients, `#rrggbbaa`) is not drawn, and the choice form warns. Alpha was left out because
   nothing asked for it; it would be easy in all three places (SVG `fill-opacity`, sprite alpha,
   GD alpha).
6. **The setting lives in the Mask section** (Marc, 2026-11-12, was open point C).
7. **The colour is saved with the configuration** (Marc, 2026-11-12, was open point D), in
   `layer_data->color`, like `image` and `mask`.

## What draws

- A layer setting **"Draw the choice colour in the viewer"** (`draw_choice_color`, boolean, off by
  default), in the layer's **Mask** section: it only works with masks, and that section is already
  2D-only and limited to image layers. Shown on simple and multiple layers, the layers whose
  choices have the colour field. Opt-in, because many products already have swatch colours *and*
  images, and switching it on everywhere would change their pictures.
- On an angle, a choice of such a layer draws its colour when:
  - it has **no image on that angle** (an image wins, decision 4, so a layer can mix colour
    choices and image choices, e.g. plain colours and a printed fabric), and
  - the layer has a **mask on that angle** (the mask gives the size; see below), and
  - its `color` is `#rgb` or `#rrggbb` (decision 5).
  Otherwise it draws nothing on that angle, as a choice without an image does today.
- **Size and place: the mask's.** A colour has no size of its own. It fills a box of the mask's
  natural size (`masks[].image.dimensions`), placed as an image of that size would be, so the
  "same size as the layer's images" rule of masks holds: the mask is that size already.
- **No mask, no colour.** Filling the whole frame would paint over the product. The Mask section
  shows a notice for each angle without a mask while the setting is on.
- Multiple choice layers: each selected colour is drawn, in choice order, under the same mask, so
  the last one covers the others. Expected; the docs say so.
- **2D only.** A 3D product ignores the setting (see [3D](#3d)).

One front-end helper decides it for the three renderers and the admin previews:
`PC.fe.choice_color.fill( choice, angle_id )` → `{ color, mask, width, height }` or `null`.
`PC.fe.viewer_state.has_drawable()` returns true when the choice has a fill on any angle (today it
only asks `has_image()`, so a colour choice would never get a layer view), and `viewer.js` uses
`has_drawable()` where it checks `has_image()` directly (the layer view creation and
`get_capture_source()`).

## The `<img>` stack

- `viewer-layer.js` (the choice view's `render()`, which reads `get_image()`; static layers have
  no colour field): when the choice has no image on the angle and `fill()` returns one, the `src` is
  the fill's data URL, through `PC.fe.layer_masks.set_src()` like any image. That keeps the image
  waiting for its mask, counted in `imagesLoading`, and held by the pools while it loads.
- The data URL: `data:image/svg+xml,` + the URL-encoded
  `<svg xmlns="http://www.w3.org/2000/svg" width="W" height="H" viewBox="0 0 W H"><rect width="W" height="H" fill="#rrggbb"/></svg>`.
  `width` and `height` give the `<img>` the mask's intrinsic size, so the theme CSS sizes it
  exactly like a layer image and the mask (`contain`, `center`) lies over it. The `dimensions`
  data of the view is the mask's.
- Same URL for the same colour and size, so switching back to a colour is a cached load.
- **Capture** does not draw the SVG: `get_capture_source()` returns a scratch canvas filled with
  the colour (`fillRect`) at the capture's size, and `draw_masked()` cuts it like an image. No
  question of whether a browser taints a canvas with an SVG image, and nothing kept after.
- The admin **Image order** preview draws the same data URL in its tiles, cut the way it cuts
  masked images.

## The canvas viewer

- `parts_of()` gains a part `{ color, mask, width, height }` next to `{ url, mask }` and
  `{ item, key }`.
- Drawn as a sprite of Pixi's shared `Texture.WHITE` with `tint` = the colour, sized to the mask's
  natural size and scaled and placed like an image sprite of that size. No texture is loaded or
  counted in the budget; only the mask texture is, as today.
- The mask applies unchanged: node mask for one drawing, per-sprite for several.
- **Loading:** settled as soon as its mask is (a pending mask keeps the layer loading, a failed one
  draws the fill unmasked, as the masks spec says for images: decision 6 there). With no mask the
  helper returns no fill, so "unmasked" only happens on a failed load.
- **Snapshots:** `picture_key()` includes the colour, so a colour change makes snapshots stale.
  The idle refresh and `capture()` draw the sprite like the live stack.

## The server merge

- `Choice::get_color()`: the saved `layer_data->color` when `is_stored()`, else the choice's
  `color` when the layer has `draw_choice_color` on and the choice has no image for its angle;
  normalised to `#rrggbb`, empty otherwise. Filter `mkl_pc/choice/color`.
- `content` entries get `color`, the way they got `mask`. Their `image` stays empty.
- **Token** `s<rrggbb>m<mask id>`, e.g. `s1e90ffm68` ("solid"). `s` is not a hex digit, so it
  cannot be read as part of an add-on token (text overlay's md5, the upload preview's `u<md5>`),
  and `parse_layer_token()` matches `^s([0-9a-f]{6})m(\d+)$`. A colour always has a mask, so the
  token always has both parts.
- `collect_layer_images()` adds `{ color, mask }` for those entries; `merge_masked()` (a colour
  always goes through the masked path) makes an `Image::canvas()` of the mask's size × the scale,
  filled with the colour, then `apply_mask()`. Same GD cost as a masked image at the output size
  (0.11 s at 1200×675). If the colour is the bottom layer, its size sets the picture's size, like
  a first image does.
- A mask that cannot be read: the colour is merged unmasked and logged (masks spec, decision 6).
- File names, the REST on-the-fly merge and the cart / order / YITH merge lists carry the token
  like any other.

## Saved configurations

`save-data.js` writes the colour into the choice's `layer_data` (`color`), next to `image` and
`mask`, only when the choice draws one (decision 7). Orders and quotes then keep their colour when
the choice's hex is changed later ([choice resolves live, not stored](#related)).

## Admin

- The checkbox in the Mask section, with the per-angle notice when a mask is missing.
- On the choice form, when the layer has the setting on: a warning under "Color hex code" when the
  value is not a hex the viewer can draw (decision 5), and a hint that an image on an angle
  replaces the colour there.
- The size check of the Mask section has nothing to compare for colour choices (they take the
  mask's size), so it ignores them.
- Import, export, global layers and their overrides carry `draw_choice_color` like any layer field.
  Nothing for Fix images to remap: the colour is a value, and masks are remapped already.

## 3D

Not part of this step. The 3D viewer already has "Change material color" actions with their own
colour. A later option there, "use the choice's colour", would let the same hex drive both viewers.

## Shading

A flat fill looks like a sticker on a shirt or a sofa. Two ways:

1. **Now:** an ordinary layer above it with a transparent shading PNG (shadows and highlights). It
   works in all three places today and needs nothing new; the docs show it.
2. **Later: tinting.** Multiply a greyscale texture by the colour instead of filling flat, so one
   layer carries fabric, folds and colour. Native in Pixi (`tint` on the texture's sprite);
   Imagick `COMPOSITE_MULTIPLY` or a GD loop on the server. The `<img>` stack is the hard one: CSS
   cannot tint an `<img>`, and an SVG inside an `<img>` cannot load the texture (SVG images load
   no external resources), so it would take an inline SVG filter or `mix-blend-mode` stacking.
   Its own spec when someone asks.

## Later: a colour picker

Marc, 2026-11-12: a customer colour picker is a good future improvement. What this step keeps open
for it:

- **The drawing does not care where the colour comes from.** `fill()` and `Choice::get_color()`
  are the only places that read it; a picker adds a source, nothing in the renderers changes.
- **Likely shape:** a Form builder field type `color` (`text_field_type`), on a form layer or on a
  choice through `has_text_field` like the other fields. When the choice is a colour field, its
  value (`field_value`, already saved with the configuration) is the colour; otherwise the hex code
  is. Options to decide then: free colour or a palette, a price, how the cart and order show it
  (swatch + hex).
- **Server:** the value comes from the customer, so it is checked strictly (`#rrggbb` only) before
  it reaches a token or a file name.
- **Cache growth:** with a fixed list the merged pictures are bounded by the combinations; with a
  free colour every value is a new file. The merged-image cache then needs a clean-up like the
  upload preview's sweep.

## Phasing

1. **Data and admin.** `draw_choice_color`, the Mask section checkbox and notices, the choice form
   warning, `PC.fe.choice_color.fill()`, import/export.
2. **Server merge.** `get_color()`, the `content` field, the token, the canvas fill in
   `merge_masked()`, saved `color`. Checked: a colour under a mask against a reference composed by
   hand; a colour as the bottom layer; an unreadable mask.
3. **`<img>` stack.** The data URL through `set_src()`, `has_drawable()`, capture, the Image order
   preview. Checked against the server merge, pixel by pixel within rounding, with and without the
   image pools.
4. **Canvas viewer.** The colour part, the tinted sprite, the picture key. Checked against the
   stack and the server, a snapshot refresh, a failed mask.
5. **Docs.** A user page (colour choices, masks needed, an image wins, shading with an overlay
   layer), the token and the saved `color` in the hooks pages.

Ship 1 to 4 together, as for masks: a viewer that ignores the setting would show nothing where the
server merge shows a colour.

## Open points

None: A to D became decisions 4 to 7.

## Related

- [`layer-masks-spec.md`](layer-masks-spec.md): the masks this draws under, and the rules (one
  image at a time, failed mask = unmasked) it follows.
- [`canvas-viewer-spec.md`](canvas-viewer-spec.md): parts, textures, snapshots.
- [`image-overlay-spec.md`](image-overlay-spec.md): the other feature that fills a mask with
  something that is not a choice image.
- Choice resolves live, not stored: why saved configurations keep their own `image`, `mask` and
  now `color`.
