# Frontend SVG icons

Every `.svg` under this folder is inlined into the **frontend** JavaScript bundle by
`scripts/build-svg-icon-registry.js`, which writes
`src/assets/js/source/generated/svg-icons.js`. Import that module and look an icon
up by its path here, minus the extension — `orbit-hint/ring.svg` is `orbit-hint/ring`.

Icons anywhere else under `src/assets/icons/` go to the **admin** registry only
(`PC.MKL_PC_SVG_ICON_REGISTRY`), which the frontend never loads. Put an icon here only
if the shopper-facing bundle needs it — every file in this folder is shipped to every
visitor whether it is used or not.

Edit these as ordinary SVG files. Three rules keep them working once inlined:

- **Colour comes from `currentColor`.** The viewer sets the colour on a parent; a
  hard-coded `fill="#fff"` will not adapt.
- **No `width` or `height` attributes.** The CSS box sizes the icon; a fixed size on
  the `<svg>` fights it. Keep the `viewBox`.
- **Keep the aspect ratio of the `viewBox`.** The CSS box is sized to match, so
  changing the ratio without changing the matching rule in
  `src/assets/css/scss/_3d-viewer.scss` will letterbox the art.

There is no need to keep `class`, `aria-hidden` or `focusable` attributes on the
`<svg>` — the viewer wraps each icon in its own element and hides the whole hint from
the accessibility tree. Editors that strip them are doing no harm.

Run `npm run build:svg-icons` after editing, or leave `gulp` running — it watches
`src/assets/icons/**/*.svg` and regenerates on save.
