# Choice overrides on linked global layers

Status: **specified 2026-11-19**, not built. All open points decided 2026-11-19.

Follows [global-layer-overrides-spec.md](global-layer-overrides-spec.md) (layer-level overrides,
built 2026-11-09), whose open point B ("choice-level overrides") this answers. Same model, one
level down: every link to a global layer can change any setting of any of its choices for itself,
field by field, while the list of choices stays the global layer's.

**Why.** Layer overrides let one fabric list serve the collar, the sleeves and the body with their
own name and mask. They do not let the same choice differ between areas: a price per area, a SKU
per area, a different linked product (the collar fabric is a different stock item from the body
fabric), a different default, different images where masks are not used. Use cases vary, so the
choice fields are not pre-sorted into "shared" and "per area": everything that is not a system
field can be overridden (Marc, 2026-11-19).

## What exists today

- A link's content chunk is a bare reference, `{ layerId, global_id }`.
  `Linker::strip_content_to_references()` drops every other key on every write;
  `Linker::resolve_content()` serves the global choices with only `layerId` stamped
  (`stamp_choices_layer_id()`).
- Every link already serves the choices under its own `layerId`, so selections, viewer keys,
  conditional logic rules and cart lines tell the links apart. What is missing is anything that can
  differ between them at the choice level.
- Layer overrides live on the **layer** reference (`overrides.fields` / `overrides.values`), are
  applied by `resolve_layers()`, kept by `strip_layers_to_references()`, and handled by localize,
  Fix images and the editor's per-field switch (`views/layer-overrides.js`).

## Data

### Where it is stored: the content reference

Choice overrides go on the **content** reference, not the layer reference:

```json
{
	"layerId": 12,
	"global_id": 345,
	"overrides": {
		"choices": [
			{
				"id": 7,
				"fields": [ "extra_price", "sku", "linked_product_id" ],
				"values": { "extra_price": 15, "sku": "FAB-07-COL", "linked_product_id": 812, "is_default": true }
			}
		]
	}
}
```

Here the link's choice 7 has its own price, SKU and linked product; `is_default` was overridden once
and switched off, so it waits in `values`.

Why the content reference: choice data belongs to the content owner. In `share_layers_config`
mode, layers (and so layer overrides) live on the parent, while content lives on each
variation. A local choice can already differ per variation, so a link's choice overrides do too:
an override set while editing variation A does not apply to variation B. Global configurators
(`Storage_Owner`) own content the same way and need nothing special.

### Shape

- `overrides.choices` is a **list** of `{ id, fields, values }`, not an object keyed by choice id.
  Numeric keys do not round-trip reliably through the JSON chunk encoding and the Backbone models
  (`{}` vs `[]` when empty, re-indexing), and a list is what the editor iterates anyway.
- Per choice, the rules are the layer rules:
  - **reading checks `fields` first**: a value without its field is ignored everywhere;
  - **a listed field overrides even when empty** (`linked_product_id: 0` on one link means "no linked product here");
  - a field listed with no value at all is dropped from `fields` on save;
  - **whole values**: `images` is the link's whole list of angle images, not merged per angle;
  - **translations follow their field**: `name_{lang}`, `description_{lang}` are listed with
    `name` / `description` under one switch (the server knows no languages).
- An entry with no `fields` and no `values` is dropped; `overrides` is dropped when `choices` is empty.

### Which fields can be overridden: all but the system fields

Decided (Marc, 2026-11-19): only the system fields are excluded. Everything else is overridable,
including SKU, stock settings and linked products.

Excluded, always: `_id`, `id`, `layerId`, `is_group`, `parent`, `order`, `overrides`. These define
which choice it is and where it sits in the list; the list itself (adding, removing, ordering,
grouping choices) stays the global layer's. Filter
`mkl_pc_global_layer_choice_override_excluded_fields`, mirroring the layer filter; the structural
fields above cannot be removed from it.

Fields that need a word, because overriding them changes who owns a piece of state:

- **`stock` (simple stock management).** Overridden, the link holds its own stock count: stock
  decreases on an order write to the link's `values.stock`, not to the global choice. Not
  overridden, every link decreases the one shared count, as today. See
  [Writing a resolved choice back](#writing-a-resolved-choice-back).
- **`manage_stock`, `linked_product_id`, `linked_product_qty`, `linked_product_price`, the
  `override_linked_price*` fields.** Overridable like any field. With `linked`, stock lives on the
  WooCommerce product, so a per-link `linked_product_id` is a per-area stock item with nothing more
  to do. The product's `_mkl_product_configurator_linked_products` meta is built from the content
  the save hook receives (`store_config_linked_products_ids()`), which is the effective content, so
  a per-link linked product is included. To check in phase 1: the hook fired by
  `set_content_layer()` for a global layer passes resolved content of one owner only.
- **`is_default`.** Per link: each area can open on its own fabric. Two links each having a default
  is normal; one link having two defaults is the same problem as on a local layer.
- **`html_id` / `class_name`.** Same remark as on layers: shared until overridden.

## Reading

`resolve_content()` applies each link's choice overrides after stamping `layerId`: for each entry in
`overrides.choices` whose `id` matches a global choice, the listed fields are set from `values`
(the same `apply_overrides()` logic, run per choice against the choice excluded list). It then hands
`overrides` through to the editor along with `overrides.global` per choice (the global values of the
overridden fields, never stored), as `resolve_layers()` does.

Everything downstream reads resolved content and gets each link's values with no code of its own:
the front-end data and its cached file, `Choice::get_choice()` in cart, checkout and orders, server
merge, the Extra price add-on's cart pricing, stock checks. The front-end data drops `overrides`,
as it does for layers.

An entry whose `id` matches no global choice is ignored on read and dropped on the next save of
that owner (the global choice was deleted).

## Choice ids must not be reused

`PC.app.get_new_id()` returns the highest id in the collection plus one. Delete the newest choice of
a global layer and add a new one, and the new choice gets the deleted one's id: every link's
override on the deleted choice now applies to an unrelated choice, silently, on every product that
links the layer.

Fix: **a global layer never reuses a choice id.** The global layer stores the next free choice id
(`next_choice_id`, next to its content), and choices added in the global layer's editor (its own
screen, and "Edit original" from a link) take ids from it. It is seeded from the current highest id
the first time it is read: no override exists yet, so ids reused before this change do no harm.

Local layers keep `get_new_id()` as it is; nothing refers to their choice ids from outside the
product. (Conditional logic rules do, and they have the same reuse problem today, for local and
global layers alike. Out of scope; noted so it is not mistaken for something this introduces.)

## Places that read or write the raw reference

- **`strip_content_to_references()`** keeps `overrides`, built from the choices the editor sent the
  way `overrides_from_layer()` builds layer overrides: a listed field's value comes from the
  choice's effective value, the kept value only when the choice lacks the key, and nothing on the
  excluded list. Both content write paths in `DB` go through it.
- **`reconcile_for_owner()`**, turning a link back into a local copy (the layer is local, the
  content still references a global layer): applies the choice overrides to the copy before
  writing it. Switched-off values are dropped. The other direction (local content becoming a
  reference) writes a bare reference; there is nothing to keep, as the choices were local.
- **`Linker::localize()`** (the global layer is permanently deleted): applies the choice overrides
  to each owner's copy, as it applies the layer overrides to the layer.
- **Disconnect** (unlinking one link in the editor): same as localize.
- **Fix images** (`DB::scan_product_images()`): remaps image ids inside
  `overrides.choices[].values` (`images`, and any other image a value holds), in the content
  chunk.
- **Export / import:** the export carries the references with their overrides. An import where the
  `global_id` means nothing on this site keeps the content as the owner's own data with the
  overrides applied, as for layers. To verify against the exporter in phase 1.
- **WPML mirroring** of `_mkl_product_configurator_content_N` copies the reference, overrides
  included, to the translations. Prices, SKUs and linked products are meant to be the same; an
  overridden `name` comes with its `name_{lang}`, so each language reads its own.
- **Sanitizing:** `Data_Sanitizer` walks by key, so `overrides.choices[].values.extra_price` is
  sanitized as a price. `fields` needs an entry (`sanitize_key` per item), `id` is an int.

### Writing a resolved choice back

`DB::update_choice()` reads the **resolved** content of a layer, changes one choice and hands the
whole layer to `set_content_layer()`, which, for a global layer, saves every choice to the global
layer post (`Global_Layers::save_content()`). Two callers do this today: the Stock management
add-on on every order (`update_order_stock()`, `simple` stock) and Fix images.

With choice overrides, the resolved choices carry the link's values, so this would write one link's
prices, SKUs and images into the global layer, for every link, on the first order.

`set_content_layer()` for a global reference therefore splits what it gets: for each choice, an
overridden field is written to the link's `overrides.choices[].values` (in the content reference),
every other field to the global choice (with the global values of the overridden fields restored
from the global layer, never from the resolved choice). One place to fix, and both callers are
right. A stock decrease on a link that overrides `stock` then lands in that link's count; on a link
that does not, in the shared one.

## Editor

### The choice form of a link

The per-field switch from layer overrides, on the choice form. `views/layer-overrides.js` already
works on the generic `.setting.setting-id-{key}` wrappers; it gets a choice variant (or is made to
take a target: the layer model and its `overrides`, or a choice model and its entry in the content's
`overrides.choices`).

- Off (default): the field shows the global value, locked outside "Edit original".
- On: the link's value, editable, marked **This link only**; first time from the global value,
  afterwards from the kept value. Off again: global value back, link's value kept.
- `'overridable' => false` / `true` in the choice setting definitions, as for layers; the 3D
  choice pickers and the angle image pickers opt in (`images` is one field: the whole set).
- Translations follow their field (`PC_lang.choice_override_groups`, filter
  `mkl_pc_choice_override_groups`).
- The choice list marks a choice that has overrides on this link (a **Has overrides** badge on the
  row; "This link only" is the field-level mark), so a link
  that changes a few of 135 fabrics can be read at a glance.

Adding, deleting, reordering and grouping choices stay locked on a link: they change the global
layer, through "Edit original".

### The model

A choice model in a link's collection holds the **effective** values and its overrides entry
(`fields`, `values`, `global`). The content row holds nothing extra: on save, the editor sends the
choices with their entries, and the server rebuilds `overrides.choices` from them (strip). The
editor only has to keep each `fields` right, as for layers.

### Saving the global layer

The global save payload for choices must never carry a link's override: for each overridden field,
the payload takes the choice's `global` value instead of the model's. Without this, editing the
fabrics from the "Collar" link would push the collar prices into every area.

After a global save, the other links to the same global layer reload their choices (already done)
and re-apply their own overrides on top. A choice deleted by that save loses its overrides entry.

### Price bulk edit (Extra price add-on)

Decided (Marc, 2026-11-19): the bulk edit screen edits a link's prices **for this link only**.

Today a linked layer's rows are locked there (`is_locked_global_layer()` in
`extra-price-admin.js`) unless the global layer's choices are being edited, in which case edits go
to the global layer session. With choice overrides:

- **In a product, outside "Edit original":** a linked layer's rows are editable, and an edit is an
  override. Changing a row's price switches on the override of the price fields the screen edits,
  for that choice on that link, with the new value. The row shows **Has overrides**, and has an
  action that switches the override off (the global price is back, and the link's value is kept,
  as with the form switch). A bulk action (`+10 %` on 40 selected fabrics) works the same way:
  one override per changed row.
- **While editing the original** (`is_editing_global_choices()`): as today. Edits go to the global
  layer and every link that does not override the price follows. Rows show the global values,
  with no override marks.
- **On the global layer's own screen:** as today.
- **CSV export / import:** rows are already found by the product's layer, not the choice's
  `layerId` (`extra-price-admin.js` ~951), so each link has its own rows. An export writes each
  link's effective price. An import onto a linked row creates or updates that link's override
  when the value differs from the effective one. A value equal to the global price on a row that
  is not overridden changes nothing, so a plain round trip stays quiet. Locked rows are still
  reported only when the file would change them.
- Undo goes back to the row's state before the action, override switch included.

The screen goes through the same choice-model API as the form switch (switch on, set value, switch
off), so it has no override logic of its own.

### "Edit original"

As for layers: the screen knows nothing of overrides. Entering it, the choices' overridden fields
take their global values (the link's wait in their entries, with `overrides.editing_original`
set); leaving puts them back. A product save meanwhile takes the link's values from `values`.

## Orders, carts, quotes

Nothing new. A `Choice` re-resolves against current content on every read, so a stored order shows
the link's current values, exactly as editing a local choice does today; saved `layer_data` (name,
SKU, image) still wins where it is stored. Prices and linked-product quantities are fixed in the
cart line.

## Existing data

No migration. A link without choice overrides stays `{ layerId, global_id }` and resolves as it
does now. Downgrading to a version without this ignores `overrides` on read and drops it on the
next save of that owner (the same as layer overrides).

## Not in this step

- Per-link **availability** of a choice (this fabric is not offered on the collar). Decided: no,
  conditional logic does it (open point A).
- Choice overrides on local layers (nothing to inherit from).

## Phasing

1. **Data.** Content `overrides` kept by strip and applied by resolve; the choice excluded list
   and its filter; `next_choice_id` on global layers; `set_content_layer()` splitting writes back;
   reconcile, localize, Disconnect, Fix images; export/import checked. PHP tests: round trip
   (strip ∘ resolve keeps `fields` and `values`, nothing excluded); an unlisted value is not
   applied; an override on a deleted choice is ignored and dropped on save; a stock decrease on an
   order lands in the link's value when `stock` is overridden and in the global choice when not,
   and never writes another overridden field into the global layer; localize applies listed fields.
2. **Editor.** The choice form switch, the row badge, the model, the global save payload, sibling
   reload re-applying overrides, "Edit original" for choices, `next_choice_id` used by the global
   layer's choice ids.
3. **Extra price add-on.** Bulk edit for this link only, CSV import / export of link prices.
4. **Docs.** A section in "Overriding a global layer in one product" on choice overrides, the
   filters, the Stock management page (a per-area stock count or linked product) and the price
   bulk edit page.

Checked on product 163-style data: one global fabric layer linked three times, one link with its
own price and linked product on two fabrics, a variable product in `share_layers_config` mode with
different overrides on two variations; front end, cart total, order stock in both stock modes, Fix
images, a global edit from one link not leaking into the others, localize.

## Open points

- **A. Per-link availability.** Should a link be able to offer only part of the global list?
  *Decided 2026-11-19 (Marc):* no. Conditional logic hides the choices a link does not offer.
- **B. Bulk edit.** *Decided 2026-11-19 (Marc):* yes, for this link only. See
  [Price bulk edit](#price-bulk-edit-extra-price-add-on).
