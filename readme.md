This is the development repository for https://wordpress.org/plugins/product-configurator-for-woocommerce/

----

# Product Configurator for WooCommerce

- Contributors: mklacroix, marcusig
- Tags: 3D configurator, product customizer, product builder, woocommerce, product addons
- ⭐⭐⭐⭐⭐ [Reviews on WordPress.org](https://wordpress.org/support/plugin/product-configurator-for-woocommerce/reviews/?filter=5)

**Build 2D and 3D product configurators for WooCommerce. Customers design their product with a live visual preview, then add it to the cart.**

<img width="1383" height="851" alt="screenshot-1" src="https://github.com/user-attachments/assets/dacf2c92-cbdf-4b35-aed4-bc893eac43be" />

## Description

Product Configurator for WooCommerce turns any WooCommerce product into an interactive product builder. Every option a customer picks updates a live preview, so they see exactly what they are buying before they add it to the cart, in **2D** or in **3D**.

- **2D configurator**: stack transparent image layers (Photoshop exports, 3D renders, product photography) across several views.
- **3D configurator**: upload a glTF / GLB model and let customers rotate, zoom and configure it in real time.

A single configurable product replaces hundreds of variations and images, and with global configurators and global layers you build it once and share it across your whole catalog.

## New in version 2

Version 2.0.0 is the biggest release of the plugin so far. [Read what's new in v2](https://wc-product-configurator.com/2026/08/03/whats-new-in-product-configurator-v2/), and see [Upgrading to v2](https://docs.wc-product-configurator.com/docs/upgrading-to-v2/) before updating a live shop.

### 3D configurator

Set a product's configurator type to **3D configurator** and upload a model as `.glb`, `.gltf`, or a `.zip` containing the `.gltf` and its textures.

- Choices are linked to named objects in the model, and can show, hide or move them, or change their material.
- A camera position per view, which can be imported from the model's own cameras.
- HDRI or cubemap environments, six light types, soft or real-time shadows.
- Draco and Meshopt compressed models and KTX2 textures.
- 3D scripts load only on products that use them, and secondary models can load on demand.
- The cart, orders and quotes show a screenshot of the configured model.
- Full keyboard control of the 3D view.

[3D configurator documentation](https://docs.wc-product-configurator.com/docs/product-configurator-for-woocommerce/3d-configurator/)

### Global configurators

Share one configurator between many products. Edit it once and every product using it is updated. Assign it product by product or to whole categories, and detach a single product with **Make local copy** when it needs to differ. Works with variable products too.

[Global configurators documentation](https://docs.wc-product-configurator.com/docs/product-configurator-for-woocommerce/global-configurators/)

### Global layers

Build a layer once, such as a fabric range or a color palette, and import it into any configurator. Changes reach every product using it, and any product can disconnect to customize its own copy.

[Global layers documentation](https://docs.wc-product-configurator.com/docs/product-configurator-for-woocommerce/global-layers/)

### Also in v2

- **Order data your tools can read**: the new *Configuration meta data* setting stores the configuration as one plain-text order meta per layer, for exports, invoices and ERP integrations.
- **Orders keep what was ordered**: cart items, orders and quotes render the image, layer names and choice names saved with them, so editing or renaming a configurator later no longer changes past orders.
- **Performance settings**: caching, asynchronous loading and GZIP are grouped in one section, with a new option to only render the images the configurator is showing.
- **New EV theme**, with automatic angle switch on scroll.
- Configuration import and export include 3D settings and objects, and **Save and fix images** relinks 3D files after an import.

The full list, including the new hooks and methods, is in the changelog in [`src/readme.txt`](src/readme.txt).

## Features

- **Layered 2D images** across multiple views (front, side, back…)
- **3D models** with real-time configuration (see above)
- **Multi-step configurator** and **required selections**
- **Configuration image** in the cart, orders and quotes
- **Global configurators** and **global layers**
- **Accessible**: full keyboard use, screen-reader friendly labels and live announcements, validation errors shown in-page
- **Multilingual**: compatible with WPML and Polylang, with translatable layers and choices
- **Works with any theme**: a "Configure" button by default, or shortcodes for block themes and page builders
- **Developer friendly**: PHP hooks and filters, plus a JavaScript API for the configurator and the 3D viewer

## Add-ons

Several add-ons are available on [wc-product-configurator.com](https://wc-product-configurator.com/) to extend the functionalities:

- [3D Premium](https://wc-product-configurator.com/product/3d-premium-for-3d-product-configurator/) - Turn a 3D configurator into an interactive showroom: clickable hotspots, model animations, augmented reality ("View in your space"), parts that snap onto anchors, and photo-quality postprocessing.
- [Extra Price](https://wc-product-configurator.com/product/extra-price/) - Add an extra cost to any of the choices you offer in your configurable products.
- [Save your design](https://wc-product-configurator.com/product/save-your-design/)
  - Get your customers engaged by enabling them to save the design they’ve made.
  - Download the configuration as PDF
  - Create presets
  - Share the design
- [Multiple choice](https://wc-product-configurator.com/product/multiple-choice/) - Enables multiple choices per layer. Ideal for a product’s options, or when having several individual options.
- [Stock management / Linked product](https://wc-product-configurator.com/product/stock-management-and-linked-product/) - Manage the stocks on a choice basis, or link a choice to a product in the shop, with the possibility to use its price and/or add it to the cart. Great for advanced inventory management and exporting to third party software.
- [Conditional logic](https://wc-product-configurator.com/product/conditional-logic/) - Conditionally display, hide or select items depending on other selections.
- [Form fields](https://wc-product-configurator.com/product/form-fields/) - Create forms to collect data associated to your configurable products. Perform complex price calculations in combination with the Extra price add-on.
- [Text overlay](https://wc-product-configurator.com/product/text-overlay/) - Customers can add their own custom text and instantly see how it looks on the product. Let them choose from your selection of fonts and colors to match their style. Perfect for engraving, embroidery, monogramming, or any personalized touch.
- [Advanced description](https://wc-product-configurator.com/product/advanced-description/) - Display additional information in a modal window, when the content is too large to show directly in the configurator.

## Shortcodes

- Inline configurator: `[mkl_configurator product_id=1 classes="container-class something-else"]`
- Configurator button: `[mkl_configurator_button product_id=1 classes="button primary"]Button text[/mkl_configurator_button]`

## Custom configurator themes

The configurator comes preloaded with a decent list of themes, adjustable in the WordPress Customizer.
However should you need something custom, you can use the starter theme from [GitHub](https://github.com/marcusig/product-configurator-custom-theme).

## Demos

- Check out [the live demos](https://demos.mklacroix.com/)
- [Create a test site](https://demos.mklacroix.com/wp-signup.php) - with all add-ons installed, admin access

## Documentation

- [Getting started](https://docs.wc-product-configurator.com/docs/product-configurator-for-woocommerce/getting-started/)
- [Full documentation](https://docs.wc-product-configurator.com/docs/)
- [Developer resources](https://docs.wc-product-configurator.com/docs/developer-resources/): [hooks](https://docs.wc-product-configurator.com/docs/developer-resources/hooks/), [functions and methods](https://docs.wc-product-configurator.com/docs/developer-resources/functions-and-methods/), [3D runtime API](https://docs.wc-product-configurator.com/docs/developer-resources/3d-runtime-api/)

## Requirements

- WordPress 6.0+
- WooCommerce 8+
- PHP 7.4+

## Development

The plugin source lives in `src/`; the build writes the installable plugin to `dist/`. Point your local site's `wp-content/plugins/product-configurator-for-woocommerce` at `dist/` (a symlink works well).

```bash
pnpm install
composer install
```

| Command | What it does |
| --- | --- |
| `npx gulp` | Full build, then watches SCSS, JS and icons, and runs both webpack watchers (3D viewer and 3D admin settings). This is the whole dev environment. |
| `pnpm build` | One-off full build into `dist/`. |
| `npx gulp zip` | Builds and packages `product-configurator-for-woocommerce.zip`. |
| `pnpm test` | JavaScript unit tests (`wp-scripts test-unit-js`), mostly covering the 3D viewer. |

The 3D viewer (built on Three.js, entry `src/assets/js/source/fe-3d-viewer-entry.js`) and the 3D admin settings (`src/assets/admin/js/views/3d-settings.js`) are bundled with `@wordpress/scripts`. The rest of the front end and admin JavaScript is concatenated by gulp.

## Support

https://wordpress.org/support/plugin/product-configurator-for-woocommerce/

## Bug report / feature requests

https://github.com/marcusig/woocommerce-product-customizer/issues

Do you need more hooks or changes? Feel free to fork this repo and send a pull request!
