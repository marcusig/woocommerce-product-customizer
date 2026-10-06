# 3D anchor placement

Status: **built 2026-09-24.** It replaces the first build (placement settings on layers and
choices, the `attach_to_anchor` action); see
[Changes from the first build](#changes-from-the-first-build). Checked in the browser on the dev
test product: model on an anchor and on a layout, variant switching (2 → 3 copies), Move to
anchor with the copies rebuilt, a shared file loaded once, the admin forms and pickers, and the
admin preview. Findings are under [Notes from testing](#notes-from-testing).

**Split between core and 3D Premium (2026-09-24).** Every setting and behaviour below is a
**3D Premium** feature. Without the add-on, every model is shown as modelled.

- **Core (`woocommerce-product-customizer`) keeps the infrastructure:**
  - the placement engine (`3d-anchor-placement.js`), the lookups after a move, shared-file loading
    and the attachment point;
  - the pickers and repeater field types, and the admin preview's placement manager;
  - the hooks: `api.placement` (runtime API v4), `PC.fe.viewer.placement.ready`,
    `PC.fe.viewer.choice_action_handlers`, `PC.admin.3d_preview.placement`, and the
    `mkl_pc_object3d_settings_sections` filter.
- **3D Premium (`threed-premium`) has the rest:**
  - the settings and the saved-field rules (`inc/class-placement.php`);
  - the layout state and model position requests (`assets/placement-core.js`);
  - the product page (`assets/fe-placement.js`) and the admin (`assets/admin-placement.js`).

An **anchor** is a named object in a model, usually an empty, that a part is placed on. Anchors
cover three needs, and each has its own tool:

| Need | Example | Tool |
|---|---|---|
| A part from its own file mounted where it belongs | handlebars on the frame, a crate on a rack | Model position **on an anchor** |
| A part that moves when an option changes | handlebars higher on a bigger frame | Choice action **Move to anchor** |
| Repeated identical copies whose arrangement changes | table legs: 4 on a rectangle, 3 on a round top | Model position **on a layout**, choice action **Switch layout variant** |

Layers hold nothing about placement. It lives on 3D Objects (where things sit) and choice actions
(what a selection changes).

## Concepts

### Model position (3D Objects → model)

Each model entry has a **Position**:

- **As modelled**: the default, and what every model does today.
- **On an anchor**: the model's origin goes on one anchor.
- **On a layout**: the model gets one copy per anchor of the layout's current variant.

Plus **Take the anchor's rotation** (default on) and **Take the anchor's scale** (default off),
shown unless the position is *As modelled*.

### Layout (3D Objects → new type "Layout")

A layout is a list of **variants**. Each variant has a name and a set of anchors. The anchors are
unordered, and the count can differ between variants. The first variant is the default.

```
Layout: Table legs
  Rectangular (default)   rect_leg_1, rect_leg_2, rect_leg_3, rect_leg_4
  Round                   round_leg_1, round_leg_2, round_leg_3
  Trestle                 trestle_1 … trestle_6
  Wall-mounted            (no anchors)
```

- A layout holds its **current variant**. Every model on the layout follows it, whichever order
  the customer picks things in.
- Switching the variant rebuilds the copies: 4 → 3 → 6. A variant with no anchors hides every
  model on the layout.
- Copies on a layout are **interchangeable**. They share visibility and materials, and have no
  lasting identity, because they are rebuilt on every switch. Something that must stay attached
  to "one leg", such as a hotspot, goes on an anchor or on the host instead.
- Layouts are for repeated identical objects. Individual parts use *on an anchor* and *Move to anchor*.

### One file, several models

The same file can be added as several 3D Object entries, for example "Crate front" and "Crate
rear". Each entry is a separate model with its own position, visibility and composite ids. The
viewer **loads and parses the file once**. Later entries are copies sharing its geometry and
materials. A lazy entry is only loaded when first shown; if another entry already loaded the
file, it appears at once.

### Choice actions

- **Display object**: unchanged. Shows or hides the choice's object or model while the choice is selected.
- **Move to anchor**: moves an object or a whole model onto **one** anchor while the choice is
  selected.
  - Target: *this choice's object* (the default, resolved as for every action: the choice's object,
    else the layer's, else the model), or any model, or any object inside a model.
  - A model placed on a layout can be moved too. That overrides the layout and gives a single copy.
- **Switch layout variant**: sets a layout's current variant while the choice is selected.

## Examples

### Table: shape and leg type

- **3D Objects**
  - Table tops: as modelled.
  - Layout *Table legs*: the variants above.
  - *Oak leg*, *Steel leg*, *Hairpin leg*: **on a layout → Table legs**, loaded lazily.
- **Layer "Table shape"**, per choice: *Display object* → that top, and *Switch layout variant* →
  *Table legs* → that shape.
- **Layer "Leg type"**, per choice: *Display object* → that leg model.

A new leg type is one model plus one choice; no shape choice changes. The shape choice must
switch the top and the variant together, because legs on the old top's empties are hidden with it.

### Crates: front and/or rear, loaded only when picked

- **3D Objects**: *Crate front* and *Crate rear*, the same file, each **on an anchor**
  (`anchor_crate_front`, `anchor_crate_rear`), lazy.
- **Layer "Crates"** (multiple choice, nothing selected by default): *Front crate* shows *Crate
  front*, and *Rear crate* shows *Crate rear*.

Nothing loads until a crate is picked. The second crate appears at once, and a crate colour
option recolours both, since they share materials.

### Cargo bike: frame sizes

- Handlebars, box and racks: **on an anchor** (the size S anchors).
- Each size choice: one *Move to anchor* per part.
- Put crate anchors **on the racks**, not the frame. The crates then follow the racks, and the
  size choices never touch them.

## Data

All keys are optional. Missing keys mean what the configurator does today.

### Model (`objects3d` entry, `object_type: 'gltf'`)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `placement_mode` | `'as_modelled'` \| `'anchor'` \| `'layout'` | `'as_modelled'` | |
| `placement_anchor_id` | string | `''` | Composite id (`sourceId:name`), when mode is `anchor`. |
| `placement_layout_id` | string | `''` | Id of a layout entry, when mode is `layout`. |
| `placement_follow_rotation` | bool | `true` | |
| `placement_follow_scale` | bool | `false` | |

### Layout (`objects3d` entry, `object_type: 'layout'`)

| Key | Type | Meaning |
|---|---|---|
| `name` | string | |
| `layout_variants` | `{ variant_id, name, anchor_ids: string[] }[]` | First is the default. `variant_id` is generated once and never changes, so renaming a variant does not break the choices that use it. (Not `id`: the data sanitizer treats every `id` key as an integer.) |

### Choice actions (rows in `actions_3d`)

`move_to_anchor`:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `move_model_id` | string | `''` | Model to move. Empty: the choice's own object, resolved as for other actions. |
| `move_object_id` | string | `''` | Object inside that model (composite id). Empty: the whole model. |
| `anchor_id` | string | `''` | Composite id. |
| `anchor_follow_rotation` | bool | `true` | |
| `anchor_follow_scale` | bool | `false` | |

`switch_layout_variant`:

| Key | Type | Meaning |
|---|---|---|
| `layout_id` | string | Layout entry id. |
| `layout_variant_id` | string | Variant id within that layout. |

Composite ids saved from the pickers always include their model (`2:Sphere001`). Bare names saved
before this keep resolving as today (first match, never a copy).

## Runtime

The placement engine from the first build stays: requests, the transform rule, reverting, copies,
lookups after a move, and the event. What changes is who files the requests.

### Positions

Each model or object's position is decided by requests. The highest-priority active one wins:

| Request | Priority |
|---|---|
| Model position (on an anchor / on a layout) | `[0]` |
| *Move to anchor* | `[1, layerIndex, choiceIndex, actionIndex]` |

A later layer beats an earlier one, as with image stacking in 2D. When the winner is released,
the next one applies. With none left, the object goes back to its original parent and transform,
stored the first time it moved.

A model **on a layout** is never shown as modelled. With no usable anchor (an empty variant,
or anchors missing), it is hidden, and missing anchors get one console warning each.

### Layout variants

Each layout's current variant is decided the same way. Variant requests come from *Switch layout
variant* actions, with priority `[layerIndex, choiceIndex, actionIndex]`. With no active request,
the first variant applies. A variant change re-files the requests of every model on that layout.

### Transform rule

With `A` = anchor world matrix and `P` = the object's **authored** world matrix, translation removed:

- `A'` = compose(anchor position, take rotation ? anchor rotation : identity, take scale ? anchor scale : 1)
- desired world = `A' · P`, and the object's local transform under the anchor = `A⁻¹ · desired`.

"Authored" is computed through original parents and original transforms, so an ancestor that
has itself been moved does not count. Consequences:

- An unrotated, unscaled empty leaves the part exactly as modelled. Only its origin moves.
- With scale off, the part keeps its authored world scale, even under a scaled host.
- With scale on, a negative anchor scale mirrors the part.

**Attachment point of a whole model.** When the target is a model root (model position, or
*Move to anchor* on a whole model), the point that lands on the anchor is the origin of the file's
**single top-level object**, not the file's origin. A part exported on its own keeps the location
it had in the artist's scene (a table leg saved 0.71 up at its corner). Using the file origin would
add that offset. Objects in the hidden-objects list don't count. With several top-level objects,
the file's origin is used. The point is measured when the model mounts
(`userData.pc_attach_point`) and captured with the originals, so it doesn't change when parts move
out of the model.

The object is **parented to the anchor**, so it follows the anchor's visibility and animation.

### Copies

- The model itself goes on the first anchor, and copies go on the others.
- Copies share geometry and materials. They are made node by node, skipping other models, moved-in
  nodes and other copies, and without JSON-copying `userData` (which can hold materials).
- Each copy node reads `visible`, and each copy mesh reads `material`, live from its source node.
- Copies drop the model-root markers. `findObjectsByCompositeId` returns the source and its copies;
  `findObjectByCompositeId` returns the source. A bare name never resolves to a copy.
- Skinned meshes are not copied: one warning, first anchor only.

### Shared files

The glTF load is cached by file URL for the life of the scene. The first entry gets the loaded
scene; later entries get a copy made the same way as anchor copies. Each entry keeps its own
`object_id` marker, so lookups and actions treat it as its own model. Material variants
(`KHR_materials_variants`) on a shared-file copy need checking when this is built.

### Lookups after a move

Model roots are found by their `userData` markers anywhere below `model_root`, not only as its
direct children. A model is searched without entering other models, copies, or nodes moved in from
elsewhere; nodes moved out of it are still found as its own.

### Guard rails

- An anchor inside the object being moved (a cycle) is ignored.
- Anchors are resolved again whenever a model finishes loading. An anchor in a lazy model that
  isn't loaded yet triggers that load, and the current position stays until it arrives.

### Runtime API

- `placement:changed` `{ target, anchors, copies }` / `PC.fe.viewer.placement.changed`, after
  any placement or revert (`anchors` empty on revert).
- `layout:variant_changed` `{ layoutId, variantId }` / `PC.fe.viewer.layout.variant_changed`.

## Admin

- **Model entry** in 3D Objects:
  - *Position* select: As modelled / On an anchor / On a layout.
  - On an anchor shows a single anchor picker; on a layout shows a select of layout entries.
  - The two *Take the anchor's…* checkboxes show unless the position is *As modelled*.
  - One line of help defines an anchor: "A point in another model, usually an empty, where this goes."
- **Layout entry** (new *Add 3D item* type):
  - A name, and a list of variants that can be added, removed and reordered. The first is marked
    *default*.
  - Each variant has a name and a multi anchor picker.
- **Move to anchor** action:
  - *Object to move*, with the placeholder "This choice's object".
  - A single anchor picker, and the two checkboxes.
  - A line saying what will move ("Moves: Suzanne (Chair model)"), resolved through inheritance.
- **Switch layout variant** action: a layout select, then a variant select.
- **Pickers**
  - The anchor picker is grouped by model. Within each model it lists, in order: empties with
    "anchor" in their name (any case), then the other empties. A toggle shows all objects.
  - Object pickers start each model's group with a **Whole model** entry.
  - Everything is shown by name and model ("round_leg_1 (Round top)"), never as a raw id.
- **Layer and choice forms** keep today's labels and inheritance hints: *3D model*, *Object in the
  model*, "Inherit from layer: …", and the choice's object picker falling back to the layer's model.
- **Admin preview** should apply model positions, with layouts on their default variant. Showing the
  effect of the choice being edited is a later step.

## Authoring rules (for the docs)

- A part's origin is its attachment point. For a model file, that is the origin of its single
  top-level object (or the file origin if it has several).
- Rotate or tilt the empty, not the part. An unrotated empty changes nothing.
- Don't scale empties to see them. Use the empty's display size.
- Attach things to what they physically sit on (crates on racks, not the frame). Then only the base
  parts need to move.
- Don't move an object that has its own animation. Move the group that contains it.

## Changes from the first build

Nothing here has been released, so there is no data to migrate. Settings saved on the dev test
product under the old keys are simply ignored.

**Remove**
- Layer and choice *Position on anchors* (`object_3d_anchor_*`): PHP fields, the admin block and
  its show/hide logic, sanitizer entries, `_registerDefaultPlacements`, and the choice view's
  `_apply_position` / `_release_position`.
- The `attach_to_anchor` action (several anchors, copies). *Move to anchor* takes one anchor;
  copies come only from layouts.

**Keep**
- The placement engine (`3d-anchor-placement.js`) and its tests.
- The lookup changes in `3d-scene-utils.js`, the plural runtime API, and the event.
- The layer and choice labels, the inheritance hints, and the choice object picker's fallback to
  the layer's model.

**Add**
- Model position fields on the model entry, and the requests they file.
- The Layout object type: admin collection, form, sanitizer, and the variant state in the viewer.
- The `move_to_anchor` and `switch_layout_variant` actions.
- Hiding a layout model that has no usable anchor.
- The glTF load cache by URL, with a copy per extra entry.
- The picker improvements: "anchor" empties first, then other empties; *Whole model* entries; model-qualified ids.
- The admin preview applying model positions.
- A rewrite of the user docs page *Placing parts on anchors*.

## Also built

- **Copies stay in step with their source.** When a part moves out of a model that has copies (or
  back in), those copies are rebuilt from the source, so they never keep a part the source no
  longer has.
- **A layout's variant ids are repaired** when the layout is opened in the admin (before the
  variants editor renders), in case any are missing.
- **Repeaters can name their add button** (`add_label`): the variants editor says "Add variant".

## Notes from testing

- **Display object hides the inherited model too.** When a choice with *Display object* and its
  own *Object in the model* is deselected, the choice view hides the target object **and** the
  model the choice resolves to (its own, else the layer's). With a layer model shared by several
  choices, deselecting one hides the whole model until another *Display object* shows it again.
  This comes from `choice-view.js`, not from placement; not changed here.
- **Bare object ids and shared files.** An id saved without its model ("Sphere") matches the
  first model containing that name. Once two 3D Objects share a file, that can be the wrong entry,
  and a lazy entry may never load because its target seems found elsewhere. The pickers now save
  model-qualified ids; older bare ids should be re-picked.
- **The admin preview hides lazy models**, as before. Models placed on a layout that are lazy
  therefore don't show there.

## Later

- Showing the effect of the choice being edited in the admin preview.
- Hotspots and animation triggers acting on copies (plural lookups, `placement:changed`).
- A warning when two choices move the same object.
- Checking whether a lazy model loaded as an anchor host briefly shows before its visibility rules apply.
