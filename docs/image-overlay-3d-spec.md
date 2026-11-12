# Image overlay on 3D products: the customer's upload on the model

Status: **phases 1 to 3 built 2026-11-11** (admin, front end, print file and docs), not yet tried on a model; dragging on the model (C) is the later step. Decisions A to E answered (below).

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

- **Object**: the object of the model the image is drawn on (decision A), from every model in 3D
  Objects, since an upload field is often on a form layer, which has no model. Stored as
  `image_target_3d`, a composite id `sourceId:image_location_…`, the form the viewer's
  `findObjectsByCompositeId` takes.
- **Zone**: set in core's zone editor on a reference texture (no view; "texture" labels, as text
  overlay passes them). Stored on the choice as `image_zone_3d`: `{ ref_image, position }`, the
  same shape as a 2D zone.
- **Mask**: optional, one, on the reference texture: the image only shows where it is opaque.
  The same mask picker as 2D, with one slot instead of one entry per view: `zone_masks_3d`,
  `[ { angleId: '3d', image } ]`, the shape of `zone_masks` (core's `PC.views.mask_picker`
  `slots` option).
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
   removed and the originals put back when the field has no file or its choice is not shown. The
   target then shows its own material, or the texture another choice's action gives it (one
   choice a fabric, another the upload). With **Hide the object while it has no image**
   (`upload_preview_hide_3d`, added 2026-11-12), it gets a clone with `visible` off instead, for a
   mesh with nothing to show of its own (an unlit material whose texture was left out of the GLB
   renders black). The material is hidden, not the object: the object's visibility belongs to
   choice actions and conditions. The clone is white and opaque, so the image keeps its colours,
   with a polygon offset so a plate lying on the surface wins the depth test.
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

**A print file** (decision E), drawn by the server from the stored file and placement when the
cart, the quote request or the admin editor has the file (`compose_print()`, Form builder): the
zone, upright, at the upload's own resolution (one upload pixel per print pixel at the customer's
size, up to `print_max_size`, 4096 by default), the upload as placed in it, cut by the zone's mask
(the mask's part under the zone, turned upright). Not the texture-sized picture first proposed: at
the texture's resolution a small zone would print a few hundred pixels of a large photo. Stored as
the 2D picture is (a `u…` token in `mkl-pc-upload-previews/`, swept the same way), under
`upload_print_file` in the choice's data, and linked as **Print files** in the order line and the
quote request in the admin, through an admin-post download checked like the uploaded files'
(`mkl_pc/user_can_download_attached_file`).

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
3. **Print file** (E), and the docs. Done.
4. Later: dragging on the model (C).

## Related

- [`image-overlay-spec.md`](image-overlay-spec.md): the 2D upload preview, its placement and
  controls.
- Text overlay: `js/views/overlay-viewer-3d.js` (`Text_Overlay_3D_Manager`), the admin's
  `text_target_3d` select and 3D placement in core's zone editor.
- Core 3D viewer: `main-viewer.js`, the runtime API (`_runtimeApi`) and
  `PC.fe.viewer.runtime.ready`.
