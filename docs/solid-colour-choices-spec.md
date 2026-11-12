# Solid-colour choices (2D)

Status: **specified 2026-11-12; built (phases 1 to 5). Left: a run on the iPhone.** Decisions 1 to 7 are Marc's (2026-11-12);
nothing is open.

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
7. **The colour is saved with the configuration** (Marc, 2026-11-12, was open point D). Built as
   the choice's saved `image`, `s<rrggbb>`, next to its `mask` (see
   [Saved configurations](#saved-configurations)), rather than a `color` key.

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

- **A colour travels as an image.** Wherever an image id goes (a choice's `image_id`, a `content`
  entry's `image`, a saved `layer_data->image`), a colour goes as `s<rrggbb>` ("solid"), with
  the layer's mask in `mask` as for a masked image. This is the seam text overlay's md5 tokens and
  the upload preview's `u<md5>` already use, so the cart, order, YITH and native quote merge lists
  needed no change. `s` is not a hex digit, so no add-on token can read as a colour.
- `Choice::get_image_id( 'image' )` returns `s<rrggbb>` when nothing usable was saved and the
  choice, as the product is now, has no image on its view, its layer has `draw_choice_color`
  and a mask on that view, and its colour is a hex code (filter `mkl_pc/choice/color` on the
  raw value). `Choice::get_color()` reads the colour back from it.
- **Token** `s<rrggbb>m<mask id>`, e.g. `s1e90ffm68`; `parse_layer_token()` matches
  `^(\d+|s[0-9a-f]{6})m(\d+)$`. Helpers on `Configuration`: `parse_color_image()`,
  `color_image()`, `normalize_color()`.
- `collect_layer_images()` gives `{ color, mask }` for those entries; `merge_masked()` (a colour
  always goes through the masked path) makes an `Image::canvas()` of the mask's size × the scale,
  filled with the colour, then `apply_mask()`. Same GD cost as a masked image at the output size
  (0.11 s at 1200×675). If the colour is the bottom layer, its size sets the picture's size, like
  a first image does.
- **Never a single attachment.** `content_has_single_image()`, `save_image()` and
  `get_image_file()` count a colour as a layer (it has no file path) that must be merged, even
  alone. `get_image_file()` used to refuse any stack of one, so a masked image alone was never
  merged to a file either; it now is.
- A mask that cannot be read: over other layers the colour fills the picture so far, unmasked,
  and is logged (masks spec, decision 6); as the bottom layer nothing gives it a size, so it is
  left out and logged.
- File names and the REST on-the-fly merge carry the token like any other.

## Saved configurations

`save-data.js` saves a choice that draws its colour with `image: 's<rrggbb>'`
(`PC.fe.choice_color.saved_image()`), and so with its `mask`, which is only saved next to an
image (decision 7). `get_saved_image_id()` already accepts alphanumeric tokens, so orders and
quotes keep their colour when the choice's hex is changed later
([choice resolves live, not stored](#related)).

As for images, a saved image of `0` means "saved without one", while an empty or missing one
means nothing usable was saved: the product's current state is used, colour included. So a
choice saved without an image before its layer drew colours shows the colour if the picture is
merged again.

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
   *Built 2026-11-12:* the layer setting (boolean in the sanitizer, removed on 3D); a
   `missing_notice` option on `PC.views.layer_masks`; `PC.views.choice_color_hint`
   (`admin/js/views/choice-color.js`) under the colour field; `PC.fe.choice_color`
   (`views/parts/choice-color.js`): `normalize()`, `fill()`, `has_fill()`. Jest:
   `choice-color.test.js`, which also checks the admin and front-end hex rules agree.
2. **Server merge.** `get_color()`, the token, the canvas fill in `merge_masked()`, the saved
   colour. Checked: a colour under a mask against a reference composed by hand; a colour as the
   bottom layer; an unreadable mask.
   *Built 2026-11-12:* the colour travels as `image` `s<rrggbb>` (see [The server merge](#the-server-merge)),
   so no `color` key was added anywhere; `save-data.js` saves it through
   `PC.fe.choice_color.saved_image()`. Suite `tests/php/solid-colour/merge.php` (36 checks): tokens;
   a colour alone, at full and half size, its alpha equal to the mask's on every pixel and its colour
   exact; a colour over the dial (colour inside the mask, dial outside); an unreadable mask over an
   image and alone; Configuration file names and files; a masked image alone now merged; Choice live
   (image wins, no mask, not a hex, setting off, the filter) and stored (kept colour, image 0, empty
   image); the cart's merge list. The REST route served `67-s1e90ffm68` as expected (the case shape
   in blue over the dial). All other suites pass but `quote-requests/yith-accept`, which fails on
   master too.
3. **`<img>` stack.** The data URL through `set_src()`, `has_drawable()`, capture, the Image order
   preview. Checked against the server merge, pixel by pixel within rounding, with and without the
   image pools.
   *Built 2026-11-12:* `viewer_layer.render()` sets the SVG src and keeps `color_fill`;
   `layer_masks.mask_for()` cuts a fill (`is_fill_url()`) but still never the transparent
   placeholder; `viewer_state.has_drawable()` counts colours, which covers the pools and
   `add_single_choice()`; `get_capture_source()` returns `fill_canvas()` for a fill. The rule is now
   `fill_for( layer, choice, angle_id )`, without `PC.fe` globals, and the admin keeps a copy of it
   and of `svg_url()` (Jest checks they agree on every case); the Image order preview draws a fill
   as an SVG tile cut by the mask. Checked on 613 in the page (band layer, Steel and Brown leather
   made colour choices on Front, nothing saved): the fill's `<img>` box equals the case image's
   (412×670), so themes size it like a layer image; capture against the server merge at 532×864,
   premultiplied, at most 4 off (the band's own image under the same mask: also at most 4), with
   the case and with the band image as mask; switching colours, an image choice under the mask, the
   Back view (image, no mask), back to Front; both pool settings; an unloadable mask (colour
   unmasked at the mask's size, nothing left loading). Not checked: the Image order preview in the
   admin, Safari.
4. **Canvas viewer.** The colour part, the tinted sprite, the picture key. Checked against the
   stack and the server, a snapshot refresh, a failed mask.
   *Built 2026-11-12:* `parts_of()` gives `{ fill, key, mask }` (key from `fill_key()`, so a colour
   change makes snapshots stale); `sync_layer()` gives an entry its `fill` and `fill_key` and
   compares both, like `url`, to decide whether it changed; `load_fill_entry()` waits for the
   layer's mask (a failed one draws the colour uncut), then adds `fill_sprite()`: Pixi's shared
   `Texture.WHITE`, tinted, at the mask's natural size, placed like an image of that size, so the
   node and per-sprite masks apply unchanged; no texture record, nothing in the budget. The idle
   refresh and `capture()` draw the same sprite (capture at the output's scale). Jest: parts and
   picture key, the sprite, an entry waiting for its mask, one removed meanwhile. Checked on 613 in
   the page, as for phase 3: capture against the server merge, at most 4 off on every visible
   pixel (52 pixels), 70,081 opaque blue pixels, the same numbers as the stack's; switching colours,
   an image under the mask, Back (image, unmasked) and Front again, nothing held or loading; a
   refreshed snapshot identical to the live picture on every pixel; a lost and restored WebGL
   context (same picture after); an unloadable mask (colour uncut, settled). Not checked: Safari
   and the iPhone.
5. **Docs.** A user page (colour choices, masks needed, an image wins, shading with an overlay
   layer), the `s<rrggbb>` token, `mkl_pc/choice/color`, and the saved colour image in the hooks
   pages.
   *Written 2026-11-12 in wpc-docs:* `general-usage/drawing-choice-colours-in-the-preview.md`
   (two screenshots still to take), linked from the General usage index and from Masking a layer;
   `mkl_pc/choice/color` in the data hooks (table row, a section with an example, the saved colour
   in the saved-data list); the `s<rrggbb>m<mask>` token next to the masked one in the cart hooks;
   the saved colour image in the JS save-data section.

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
- Choice resolves live, not stored: why saved configurations keep their own `image` (now also a
  colour) and `mask`.
