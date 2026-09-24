# 3D anchor placement

Status: implemented for the first 3D release. The frontend runtime has been checked on a real model; the admin UI has not yet been tried in a browser.

Moves an object (a whole model or any node) onto one or more anchors (usually empties in another
model). With several anchors the object is copied, one per anchor. The placement can be set as
a default on a layer or choice, and changed by a choice action.

## Data

All new keys are optional. When a key is missing, the behaviour is what the configurator does today.

### Layer and choice (next to `object_3d_id`)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `object_3d_anchor_ids` | string[] | `[]` | Composite ids (`sourceId:name`) of anchors. Empty = where authored. |
| `object_3d_anchor_follow_rotation` | bool | `true` | Placed object takes the anchor's rotation. |
| `object_3d_anchor_follow_scale` | bool | `false` | Placed object takes the anchor's scale. |

On a layer, this places the model the layer displays. On a choice, it places only the choice's
**own** `object_3d_id`. A model inherited from the layer is the layer's to place, and a choice that
needs to move it uses the action below.

### Choice action `attach_to_anchor` (row in `actions_3d`)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `anchor_target_id` | string | `''` | Object to move (composite id). Empty = the choice's target object, else its model. |
| `anchor_ids` | string[] | `[]` | Anchors. |
| `anchor_follow_rotation` | bool | `true` | |
| `anchor_follow_scale` | bool | `false` | |

Undoing the action works like every other choice action. It is released when the choice is
deselected or hidden.

## Transform rule

With `A` = anchor world matrix and `P` = the object's **authored** world matrix, translation removed:

- `A'` = compose(anchor position, follow rotation ? anchor rotation : identity, follow scale ? anchor scale : 1)
- desired world = `A' · P`, and the object's local transform under the anchor = `A⁻¹ · desired`.

"Authored" means the object's transform through its original parents. It is computed from the
stored originals, so an ancestor that has itself been moved does not affect it. Consequences:

- An axis-aligned, unscaled empty leaves the part looking exactly as it was modelled. Only its
  origin moves onto the empty.
- With scale off, the part keeps the world scale it was authored at, even under a scaled host hierarchy.
- With scale on, a negative anchor scale mirrors the part.

The object is **added as a child of the anchor**, so it follows the anchor's visibility and animation.

## Precedence

Every placement is a request `(key, target, anchors, follow flags, priority)`. For each target, the
active request with the highest priority wins. Priorities are compared as arrays:

- Layer or choice default: `[0, layerIndex, choiceIndex]`
- Choice action: `[1, layerIndex, choiceIndex, actionIndex]`

So actions beat defaults, and a later layer beats an earlier one, as with image stacking in 2D.
A request whose anchors cannot be found (the host is loaded but has no such node) is skipped, with
one console warning, and the next request is used. A request whose host is not loaded yet
triggers that load, and the current placement stays until it arrives.

## Reverting

The first time an object is moved, its original parent and local position, rotation and scale
are stored. When no request is left, the object goes back to exactly those values. It never
returns to "the position before the last move", which would drift when choices are undone in a
different order.

## Copies (several anchors)

- The object itself goes on the first anchor. Copies go on the others and share geometry and
  materials. They are made node by node, not with `clone(true)`, because they have to skip
  subtrees that belong to something else (other models on its anchors, moved-in nodes, other
  copies) and must not JSON-copy `userData`, which can hold materials.
- A copy mirrors its source: each copied node's `visible`, and each copied mesh's `material`, are
  read live from the source node. Layer visibility, `toggle_visibility` and material actions
  aimed at the source therefore show on every copy.
- Copies drop the model-root markers (`userData.object_id` and `attachment_id`), so composite
  lookups never mistake a copy for a model. `findObjectsByCompositeId` returns every copy of each
  match (source first). `findObjectByCompositeId` returns the source.
- Skinned meshes are not copied. They get a console warning and only the first anchor is used.

## Lookups after a move

A model root can now sit anywhere in the tree, not just directly under `model_root`. Composite
lookups find model roots by their `userData` markers anywhere below `model_root`. They search a
model without going into another model nested under one of its anchors.

## Guard rails

- An anchor inside the object being moved (which would make a cycle) is ignored.
- Anchors are resolved again whenever a model finishes loading.

## Runtime API

- Event `placement:changed` `{ target, anchors, copies }`, and action
  `PC.fe.viewer.placement.changed`. Fired after an object is placed or reverted.
  `anchors` is empty on revert.

## Admin

- Layer and choice, 3D section: an "Anchors" list with *Select from list* (all models, several
  can be picked) and *Clear*, plus the two follow checkboxes.
- The action "Attach to anchor" has fields for the object to move (single picker, all models), the
  anchors (multi picker), and the two follow checkboxes.
- The admin 3D preview does not apply placements; it shows the models as authored.

## Authoring rules (for the docs)

- The part's origin is its attachment point.
- Don't attach a node that is itself animated; attach its parent group.
