# Image overlay on 3D products: the customer's upload on the model

Status: **specced 2026-11-11, not built.** Decisions A to E answered (below).

The 2D upload preview ([`image-overlay-spec.md`](image-overlay-spec.md)) left 3D out: "an image on
a mesh is a decal or a texture swap, its own spec." This is that spec. It builds on what text
overlay already does in 3D, and on what the 2D upload preview already has: the field's settings,
the placement, its controls and its storage.

## What 3D does today

- **Admin**: the upload field has no Preview section on 3D configurators (Form builder,
  `add_choice_sections()` returns early for `3d`).
- **Front end**: the field takes the file as it always has. The image does not show on the model:
  the preview is a canvas viewer item, and the 3D viewer has no items.
- **Cart and order pictures**: screenshots of the 3D viewer, so they do not show the upload
  either. The server composition needs 2D zones, so it never runs.

## What text overlay already does in 3D

Worth reusing, because it is shipped and has been through the hard cases:

- **Admin**: the text is placed on a **reference texture** (an image of the target's UV space) in
  core's zone editor, without a view. The choice stores `text_position_3d` (the zone, in the
  reference texture's pixels) and `text_target_3d`, an object of the model whose id starts with
  `text_location_` (the select lists them from the model's object tree).
- **Front end** (`overlay-viewer-3d.js`, `Text_Overlay_3D_Manager`), started on
  `PC.fe.viewer.runtime.ready` with the viewer's runtime API (`getScene`, `findObjectByCompositeId`,
  `getRenderer`, `requestRender`…):
  - one canvas and one `THREE.CanvasTexture` per target, sized to the reference texture, reused
    across passes (a new texture per pass meant a full upload and a shader recompile);
  - the model's materials are never written: each material slot under the target gets a clone
    the add-on owns, and the original is put back when the text goes. Choice actions write to the
    material registry, and glTF materials are shared between meshes, so writing to them leaked;
  - drawing is debounced (120 ms), and `PC.fe.save_data.before_save.promises` flushes it, so the
    cart screenshot never shows the previous state.
- **The texture is an alpha map.** The text is drawn white into it and its colour, metalness and
  roughness come from the material: right for engraving and print in one colour, and the reason a
  target can only have one colour. **An image needs a colour map** (`material.map`), so the drawing
  and the material setup differ; the surface, cloning and flushing are the same.

## Design

### Admin

On a 3D configurator, the upload field's Preview section has, instead of zones per view:

- **Target**: an object of the model, chosen like text overlay's (decision A for which ones).
- **Zone**: set in core's zone editor on a reference texture (no view; "texture" labels, as text
  overlay passes them). Stored on the choice as `image_zone_3d`: `{ ref_image, position }`, the
  same shape as a 2D zone.
- **Mask**: optional, one, on the reference texture: the image only shows where it is opaque.
  The same mask picker as 2D, with one entry instead of one per view.
- **Fit, "cannot move or zoom", minimum width**: as in 2D.

No setting for the view while editing (decision D): the choice's **Automatic angle switch** already
turns the camera when the customer picks the choice.

### Front end

A small manager in Form builder, on the same runtime hook, for the fields with a 3D zone:

1. The upload is decoded at a capped size, as in 2D (`decode()`).
2. Per target, a canvas at the reference texture's size: the upload drawn into the zone with the
   field's fit and placement (the same maths as the 2D item, `fit_scale()` and the zone's turn
   around its top centre), cut by the mask. Transparent elsewhere.
3. That canvas as a `CanvasTexture` (`flipY = false`, sRGB, anisotropic filtering, mipmaps), set as
   the `map` of a clone of each material slot under the target, with `transparent` and a small
   `alphaTest` (decision B for what is under the image).
4. Redrawn (debounced) when the placement or the file changes; flushed before save; the clones
   removed and the originals put back when the field has no file or its choice is not shown.
5. Applied to every copy of the target (`findObjectsByCompositeId`): a model placed on several
   anchors shows the image on each.

The placement is the same `{ x, y, scale, rotation }`, relative to the zone, and is saved with the
configuration as in 2D, with `upload_preview.zone_3d` instead of the per-view zones.

### Placing the image (decision C)

The field's controls work unchanged: Edit position, size, move, centre, reset, Done. What 3D lacks
is the handle over the zone: dragging on the model turns the camera. The plan:

- **First step: the controls only.** The controls move and size the image; the view is the one
  the choice's angle switch turned to (decision D). Nothing in the viewer changes.
- **Later: dragging on the model.** While editing, a press that hits the target (a raycast, which
  gives the hit's UV, so its pixel on the reference texture) moves the image instead of turning
  the camera (`getControls().enabled = false` for the gesture); elsewhere the camera turns as
  usual. Pinch and wheel zoom the image the same way. three's raycaster also hits hidden objects
  (it ignores `visible`), so the hit test keeps to the target's meshes.

### Cart, quote and order pictures

They are screenshots of the 3D viewer, so they show the image as soon as it is on the material
before the screenshot (flushed in `before_save.promises`, as text overlay does). Nothing to
compose on the server for the picture.

**A print file** (decision E): the server can draw the same flat picture as 2D, the upload in the
zone on the reference texture's canvas, cut by the mask, from the stored file and placement:
`compose()` with the 3D zone instead of a view's. It is what a print shop needs, the texture's area
with the image as placed, and it costs one call in the order.

## Decisions

- **A. Which objects can be a target.** Decided: objects whose id starts with `image_location_`,
  a dedicated mesh the model's author adds where the image goes (a plate on the cap, the face of a
  phone case), with its own UVs mapping the reference texture. Like text overlay's
  `text_location_`, the model says where an image can go, and the rest of the model is never
  touched. The other option, any mesh, needs B's compositing.
- **B. What is under the image.** Decided: nothing: the target mesh is transparent outside the
  image (it is a decal mesh, A). The other option, drawing the upload over the mesh's own texture
  (a mug's body, printed all round), works on any UV-mapped mesh but needs that texture's pixels
  (same-origin or CORS), re-uploads the whole texture on every change, and breaks choice actions
  that change that texture. A later step, if asked for.
- **C. Placing in the viewer.** Decided: controls only first, dragging on the model later (above).
- **D. The view while editing.** Decided: no new setting. The choice's existing Automatic angle
  switch turns the camera to the view where the image is seen; Edit position leaves the camera alone.
- **E. A print file.** Decided: yes, from the 3D zone, with the order's files.

## Not in this step

- Projected decals (`DecalGeometry`): no UVs needed, but placement in 3D space is a different
  editor and the decal follows the mesh's curvature imperfectly. If A's dedicated meshes turn out
  to be too much work for model authors, this is the alternative.
- Text and an image on the same target. Text overlay's alpha map and this colour map would both
  clone the slot's material and fight over it. One owner per target; Form builder warns in the
  console when a text and an image share one.
- Several targets for one field (the same image on the front and the back).

## Phasing

1. **Admin**: the 3D Preview section (target, zone on a reference texture, mask).
2. **Front end**: the manager, the colour map on cloned materials, flushing before save, the
   field controls. iPhone run (texture size and memory).
3. **Print file** (E), and the docs.
4. Later: dragging on the model (C).

## Related

- [`image-overlay-spec.md`](image-overlay-spec.md): the 2D upload preview, its placement and
  controls.
- Text overlay: `js/views/overlay-viewer-3d.js` (`Text_Overlay_3D_Manager`), the admin's
  `text_target_3d` select and 3D placement in core's zone editor.
- Core 3D viewer: `main-viewer.js`, the runtime API (`_runtimeApi`) and
  `PC.fe.viewer.runtime.ready`.
