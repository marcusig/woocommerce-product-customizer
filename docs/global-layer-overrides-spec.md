# Linked global layers with overrides

Status: **specified 2026-11-09.** All open points decided 2026-11-09. Phase 1 (data) built
2026-11-09; phases 2 and 3 not started.

One global layer linked several times into the same product (or into many), each link changing a
few of the layer's settings for itself: its name, its [mask](layer-masks-spec.md), its 3D target.
The choices stay the global layer's, shared by every link.

**Why.** A shirt designer with 135 fabrics wants them on the collar, the sleeves and the body
separately. With layer masks, each area is the same fabric list cut by its own mask
(layer-masks-spec.md, decision 4 there: this is its own step). Today each area needs its own copy
of the fabric list, and adding a fabric means adding it to every copy. With this, the fabrics live
in one global layer, each area is a link to it with its own name and mask, and a new fabric
appears on every area at once. The request comes up often (shared fabric lists, 2026-11-06).

This is the "linked global layers with local overrides" proposal of 2026-11-06, reduced by masks to
layer-level overrides: no per-choice image overrides, no bulk image matching, no "missing image
here" state.

## What exists today

- A product stores a global layer as a **reference**: the layer chunk is
  `{ _id, id, is_global, global_id, order?, image_order? }`, the content chunk
  `{ layerId, global_id }` (`Linker::strip_layers_to_references()` /
  `strip_content_to_references()`, on every write).
- On read, `Linker::resolve_layers()` replaces each reference with the global layer's definition,
  keeping the local `_id`, `id`, `order` and `image_order`; `resolve_content()` serves the global
  choices stamped with the local layer id (`stamp_choices_layer_id()`). `order` and `image_order`
  are already per-link values: this spec widens that set.
- **Linking the same global layer twice already works mechanically.** The import dialog does not
  prevent it, each link gets its own local layer id, and the choices of each link carry their own
  `layerId`, so selections, the viewer's keys (`layerId:choiceId`), conditional logic rules and the
  cart tell the links apart. What is missing is anything that can differ between them: both links
  paint the same images with the same name.
- In the editor, a linked layer's form is locked unless the global layer is being edited
  ("Edit global layer"), and saving that sends the layer model as it is to the global layer
  (`PC.app.buildGlobalLayerSavePayloadFromModel()`).

## Data

The layer reference gains one optional key, `overrides`, with two parts: **which fields are
overridden** (`fields`), and **the link's values** (`values`). They are kept apart so that switching
an override off does not lose the value: switched back on, the field gets it back.

```json
{
	"_id": 12, "id": 12, "is_global": true, "global_id": 345, "order": 4,
	"overrides": {
		"fields": [ "name", "masks" ],
		"values": {
			"name": "Collar",
			"name_fr": "Col",
			"masks": [ { "angleId": 1, "image": { "id": 901, "url": "…/collar-front.png", "dimensions": { … } } } ],
			"admin_label": "Collar fabric"
		}
	}
}
```

Here `admin_label` was overridden once and switched off: the link shows the global admin label,
and "Collar fabric" waits in `values` for the switch.

- **Reading checks `fields` first** and applies only the values of those fields. A value in
  `values` without its field in `fields` is ignored everywhere (front end, cart, merge, localize).
- **A field listed overrides, even with an empty value**: a link with no mask where the global
  layer has one is `fields: ["masks"]`, `values.masks: []`. A field listed with no value at all is
  dropped from `fields` on save (it would mean "override with nothing", which nobody chose).
- **Whole values.** An override replaces the global value entirely: `masks` is the link's whole
  list, not merged per angle with the global one.
- **Every layer field can be overridden** (decision A), except the ones that define what the layer
  is: `_id`, `id`, `type`, `not_a_choice`, `is_global`, `global_id`, `order`, `image_order`,
  `overrides`. That list is `mkl_pc_global_layer_override_excluded_fields` (PHP); the server never
  stores or applies anything on it. `order` and `image_order` are already per-link and stay as
  they are.
- **Translations follow their field**: `name_{lang}` (and `description_{lang}`) are overridden
  with `name`, under its switch. Overriding the name without them would show the global name in
  the other languages. In the data they are fields like any other, listed in `fields` with
  `name`: the editor ties them to the one switch, the server knows nothing of languages.
- `strip_layers_to_references()` keeps `overrides`: `fields` filtered against the excluded list,
  `values` filtered the same way, the whole key dropped when both are empty. A listed field's
  value is taken from the layer the editor sent (its effective value, what the form edited), the
  kept value only when the layer lacks the key; so the editor only has to keep `fields` right.
  A layer that is not a link loses any `overrides` it carries. `resolve_layers()`
  applies the listed fields over the global definition and hands `overrides` through, so the
  editor knows which fields are the link's and has the stored values for the switches.
- Sanitizing: `Data_Sanitizer` walks by key, so `overrides.values.name` is sanitized as a name and
  `overrides.values.masks` like masks. `overrides.fields` needs an entry (a list of keys,
  `sanitize_key`).
- Kept values are not cleaned up while the layer stays linked: they cost a few bytes and are what
  makes the switch reversible. Localize and Disconnect drop them (the layer is no longer a link).
- **Content is not overridden.** The content reference stays `{ layerId, global_id }`; every link
  serves the global choices. Choice-level overrides (a price per area, say) are
  [open point B](#open-points).

## Where the resolved values go

Everything downstream reads resolved layers, so it gets each link's values without changes:

- **Front end:** the configurator data (and its cached file) is resolved on the server; a link's
  name, mask and 3D target are simply the layer's. `PC.fe.layer_masks`, the canvas viewer and the
  3D viewer need nothing.
- **Cart, orders, quotes:** `Choice::get_layer()` reads the resolved layer, and a stored order
  keeps its saved `layer_name` and `mask` as before.
- **Server merge:** `Choice::get_mask_id()` reads the resolved layer's `masks`.
- **Cache:** overrides live in the product's meta, so a product save invalidates its cache as for
  any layer change.

Three places read the reference itself and need to know about `overrides`:

- **`Linker::localize()`** (the global layer is going away, the product gets its own copy):
  applies the overridden fields to the copy, so each link keeps its name and mask once it is a
  plain layer. Values of switched-off fields are dropped.
  Unlinking one link from the editor ("Disconnect") does the same.
- **Fix images** (`DB::scan_product_images()`): also remaps `overrides.values.masks` (and any
  other image a value holds) in the layer chunk
  (`remap_layer_masks()`).
- **Export / import** of a configuration: the export carries the references with their
  overrides. An import onto a site where the `global_id` means nothing already keeps the layer as
  its own data (`strip_layers_to_references()`); it must keep the effective values, overrides
  applied. To verify in phase 1 against what the exporter writes.

## Editor

### The layer form of a link

Every field of a linked layer's form gets an **Override for this link** switch. The form is
built from the layer settings (`inc/admin/settings/layer.php` and the add-ons' filters), and each
field is already wrapped in `.setting.setting-id-{key}`, so the switch is added once, for every
field, in the form view (`update_global_lock_state()` already walks them to lock them). No field
needs its own code, and an add-on's layer fields get the switch for free.

- **Off** (default): the field shows the global value, locked like the rest of the form outside
  global edit mode. In global edit mode it is editable as the global value, as today.
- **On**: the field shows the link's value, always editable (global edit mode or not), marked
  **This link only**. Switching it on the first time starts from the global value; switching it
  on again restores the link's kept value.
- Switching it **off** shows the global value again; the link's value is kept for later.

So "Edit global layer" keeps meaning "edit what every link shares", and the link's own settings
never need it.

Which fields get a switch:

- Fields with a stored setting: every type that writes `data-setting="{key}"`. Display-only fields
  (`html` without an input, `separator`, help text such as `required_info`) get none.
- A field can opt out with `'overridable' => false` in its setting definition, and an `html`
  field holding its own input opts in with `'overridable' => true` (the 3D model and object
  pickers, `object_3d_id` and `target_object_id`). Fields on the excluded list (`type`,
  `not_a_choice`) never get one.
- `name_{lang}` fields have no switch of their own: they follow `name`'s.
- The Mask section is one field (`masks`): off, it shows the global masks read-only; on, the
  pickers edit the link's list.

Worth overriding on every second link, and the reason the form should say so: **`html_id`**. Two
links share the global layer's HTML id until one is overridden, which makes two elements with the
same id on the page.

### The model

The layer model in the editor holds the **effective** values (what the list, the previews and the
form show), and `overrides` (`fields` and `values`). Editing an overridden field updates both the
effective value and `overrides.values`. Switching a field on adds it to `overrides.fields` and
sets the effective value from `overrides.values` (or the global value the first time); switching
it off removes it from `fields` and sets the effective value back to the global one. Saving the
product needs nothing more: the server strips the layer to its reference plus `overrides`.

### Saving the global layer

`buildGlobalLayerSavePayloadFromModel()` must never send an override to the global layer: for each field
in `overrides.fields`, the payload takes the global value (from `PC.app.get_global_layers()`'s copy of the
global layer) instead of the model's. Without this, editing the shared fabrics from the "Collar"
link would rename the global layer "Collar".

After a global save, the **other links to the same global layer** in the editor are brought up to
date: their inherited settings take the new global values, their overrides stay. (Today a product
has one link per global layer, so only the edited model needed updating.) Their choices
collections are reloaded the same way.

### Linking a layer again

The import dialog marks a global layer already linked in this product ("In this product: 2
links"). Importing it again adds another link, as today. Nothing is overridden on a new link; the
form makes it plain that it still shows the global name, and a second link opens with the name's
switch on ([open point C](#open-points)).

## Not in this step

- Choice-level overrides ([open point B](#open-points)).
- Overrides on a non-global layer (there is nothing to inherit from).
- Overriding the layer's type, its choices, or anything structural.
- The global layer's own screen: it edits the global layer only and knows nothing of links.

## Phasing

1. **Data.** `overrides` kept by strip, applied by resolve (listed fields only), the excluded
   list, translations following their field, localize, Fix images, export/import checked. PHP
   tests for the round trip (strip ∘ resolve keeps `fields` and `values` and nothing excluded;
   a value not listed is not applied; localize applies listed fields and drops the rest).
2. **Editor.** The per-field switch (added generically), `overridable` opt-in/out in the setting
   definitions, the Mask section's two modes, the save payload without overrides, sibling links
   refreshed after a global save, the import dialog's count.
3. **Docs.** A section in the global layers docs ("Using a global layer several times"), the
   filters, and the masking page's "Several areas with the same choices", which today says to
   duplicate the layer.

Checked on a product with one global fabric layer linked three times (collar, sleeves, body), each
with its own name and mask: front end in both viewers, cart and order picture, Fix images, a
global edit from one link not leaking into the others, localize.

## Open points

- **A. Which settings can be overridden.** *Decided 2026-11-09 (Marc):* all of them, each locked
  by default with its own switch, and switching an override off keeps its value; reading checks
  which fields are overridden and applies only those. See [Data](#data) and
  [The layer form of a link](#the-layer-form-of-a-link). Excluded: the fields that define what
  the layer is (`type`, `not_a_choice`, ids).
- **B. Choice-level overrides**, for example a different price for the same fabric on the body
  than on the collar. *Decided 2026-11-09:* not now. The data has room for it later
  (`overrides.choices[ choiceId ]`), and the 2026-11-06 proposal had it as "maybe".
- **C. A new link's name.** Two links named "Fabrics" in the layer list are confusing until one is
  renamed. *Decided 2026-11-09:* no automatic override (that would be a value nobody chose), but the import
  dialog's second link opens the layer form with the name field ready to override.
