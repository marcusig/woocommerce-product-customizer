=== Product Configurator for WooCommerce ===
Contributors: mklacroix, marcusig
Tags: 3D configurator, product customizer, product builder, woocommerce, product addons
Donate link: https://paypal.me/marclacro1x
Requires at least: 6.0
Tested up to: 7.1
Stable tag: 1.7.6
Requires PHP: 7.4
License: GPLv2+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Build 2D and 3D product configurators for WooCommerce. Customers design their product with a live visual preview, then add it to the cart.

== Description ==

**Product Configurator for WooCommerce** turns any WooCommerce product into an interactive product builder. Every option a customer picks updates a live preview, so they see exactly what they are buying before they add it to the cart — in **2D** or in **3D**.

* **2D product configurator** – Stack transparent image layers exported from Photoshop, 3D renders or product photography, across several views (front, side, back…).
* **3D product configurator** – Upload a glTF / GLB model and let customers rotate, zoom and configure it in real time: show or hide parts, swap materials and colors, move components.

Add colors and swatches, conditional logic, pricing rules, form fields, file uploads and linked WooCommerce products, and replace hundreds of product variations and images with a single configurable product. Build a configurator once and share it across your whole catalog with **global configurators** and **global layers**.

No coding and no bulky setup: the configurator works with any WooCommerce theme, and everything is managed from a visual editor in the WordPress admin.

**New in version 2:** 3D configurator, global configurators and global layers. [Read what's new in v2](https://wc-product-configurator.com/2026/08/03/whats-new-in-product-configurator-v2/)

**Perfect for:**

* Bikes, bicycles and other vehicles
* Furniture, sofas and lighting
* Custom jewelry and watches
* Clothing, shoes and accessories
* Electronics, computers and simulators
* Industrial, B2B and made-to-order products
* Any product you sell in many combinations

🎮 [Check out the live demos](https://demos.mklacroix.com/)  
🛠️ [Set up a sandbox with admin access](https://demos.mklacroix.com/wp-signup.php)

Have feedback, ideas, or found a bug? Report issues on [GitHub](https://github.com/marcusig/woocommerce-product-customizer/issues) or use the [support forum](https://wordpress.org/support/plugin/product-configurator-for-woocommerce/).

=== Features ===

==== 2D and 3D visual configurators ====

* **2D Layered Images** – Compose product previews from transparent PNG layers—no need to create an image for every combination.
* **3D Models** – Configure glTF / GLB models in real time. Each choice can show, hide or move a part of the model, or change its material.
* **Multiple Views** – Show several angles of a 2D product, or saved camera views of a 3D model, each framing the part that matters.
* **Realistic 3D Scenes** – HDRI or cubemap environments, six light types, and soft or real-time shadows.
* **Fast Loading** – 3D scripts only load on products that use them, and secondary models can load on demand.
* **Configuration Image in the Cart** – The cart, orders and quotes show a picture of the configured product, in 2D or 3D.
* **Live Text Overlay** *(via add-on)* – Let customers preview custom text with your fonts and colors—ideal for engraving, embroidery, and personalization.
* **3D Premium** *(via add-on)* – Clickable hotspots, model animations, augmented reality ("View in your space"), parts that snap onto anchors, and photo-style postprocessing.

==== Reuse configurators across your catalog ====

* **Global Configurators** – Share one configurator between many products. Edit it once and every product using it is updated. Assign it product by product or to whole categories, and detach a single product with "Make local copy" when it needs to differ.
* **Global Layers** – Build a layer once, such as a fabric range or a color palette, and import it into any configurator. Changes reach every product using it, and any product can disconnect to customize its own copy.

==== Create smart configuration flows ====

* **Multi-Step Configurator** – Split complex product builds into multiple steps to streamline user experience.
* **Required Selections** – Make sure customers choose an option before they can add the product to the cart.
* **Conditional Logic** *(via add-on)* – Show/hide options dynamically depending on user selections. Perfect for complex logic flows.
* **Form Fields** *(via add-on)* – Let users enter text, numbers, or upload files—ideal for personalized orders.

==== Connect to WooCommerce ====

* **Price per Option** *(via add-on)* – Assign additional pricing to individual options (great for premium upgrades).
* **Custom Pricing Formulas** *(via add-on)* – Calculate advanced prices dynamically based on user input and selected options.
* **Inventory & Stock Management** *(via add-on)* – Track inventory per option inside the configurator, or by linking to actual WooCommerce products.
* **Linked Products** *(via add-on)* – Link any configurator choice to a real product in your WooCommerce shop:
  * Add real components to the cart
  * Track SKUs and inventory
  * Support ERP/warehouse integration
  * Build composite/bundled products
  * Use or override linked product pricing
* **Order Data Your Tools Can Read** – Store the configuration as one plain-text order meta per layer, ready for exports, invoices and ERP integrations.

==== Ready for your shop ====

* **No development required** — works out of the box on any Woo store
* **Multilingual** – Compatible with WPML and Polylang, with translatable layers and choices.
* **Developer Friendly** – Includes hooks, filters, a JavaScript API, and a clean, commented codebase to adapt it to your needs.
* **Accessible** – Full keyboard use, including the 3D view, screen-reader friendly labels and live announcements, validation errors shown in-page with links to each field

=== Shortcodes ===

* **Configurator Button:**  
  `[mkl_configurator_button product_id=1 classes="button primary"]`  
  Optional content:  
  `[mkl_configurator_button product_id=1]Button text[/mkl_configurator_button]`

* **Inline Configurator:**  
  `[mkl_configurator product_id=1 classes="your-css-class"]`

=== Themes ===

* Includes several built-in high quality themes (see Screenshots)
* Easily create your own theme for full control  
* Supports WordPress Customizer (Appearance > Customize) to change visual styles

=== Premium features ===

The core plugin is fully functional. Extend it with these premium modules:

* [**3D Premium**](https://wc-product-configurator.com/product/3d-premium-for-3d-product-configurator/) – Hotspots, animations, augmented reality, parts that snap onto anchors and photo-quality rendering for 3D configurators
* [**Extra Price**](https://wc-product-configurator.com/product/extra-price/) – Add custom pricing to options  
* [**Save Your Design**](https://wc-product-configurator.com/product/save-your-design/) – Let users save and share their designs, create configuration presets
* [**Multiple Choice**](https://wc-product-configurator.com/product/multiple-choice/) – Enable multi-select per layer  
* [**Linked Products & Stock Management**](https://wc-product-configurator.com/product/stock-management-and-linked-product/) – Link options to WooCommerce products, track inventory, sync with ERP  
* [**Conditional Logic**](https://wc-product-configurator.com/product/conditional-logic/) – Dynamically show, hide, or auto-select items based on conditions  
* [**Form Fields**](https://wc-product-configurator.com/product/form-fields/) – Add forms to collect extra input, and perform price calculations  
* [**Text Overlay**](https://wc-product-configurator.com/product/text-overlay/) – Let users preview personalized text in real time

💬 For custom development or tailored integrations, [contact me here](https://wc-product-configurator.com/contact/).

== Installation ==

There are 3 different ways to install this plugin, as with any other wordpress.org plugin.

= Using the WordPress dashboard =

1. Navigate to the 'Add New' in the plugins dashboard
2. Search for 'Product Configurator for WooCommerce'
3. Click 'Install Now'
4. Activate the plugin on the Plugin dashboard
5. Go to the FAQs and watch the "getting started" video

= Uploading in WordPress Dashboard =

1. Download the latest version of this plugin
2. Navigate to the 'Add New' in the plugins dashboard
3. Navigate to the 'Upload' area
4. Select the zip file (from step 1.) from your computer
5. Click 'Install Now'
6. Activate the plugin in the Plugin dashboard

= Using FTP =

1. Download the latest version of this plugin from https://wordpress.org/plugins/
2. Unzip the zip file, which will extract the product-configurator-for-woocommerce directory to your computer
3. Upload the product-configurator-for-woocommerce directory to the /wp-content/plugins/ directory in your web space
4. Activate the plugin in the Plugin dashboard

== Frequently Asked Questions ==

= I just found the plugin, how do I use the configurator? =
Watch the get started video on Youtube:

[youtube https://www.youtube.com/watch?v=G29aEMy-PwY]
Not enough? Ask your questions <a href="https://wordpress.org/support/plugin/product-configurator-for-woocommerce/">on the support forum</a>

= Can I use 3D models? Which formats are supported? =
Yes. Set the product's Configurator type to "3D configurator" and upload a glTF model, as a `.glb` file, a `.gltf` file, or a `.zip` containing the `.gltf` file and its textures. Models compressed with Draco or Meshopt, and KTX2 textures, are supported through options in the settings.

The parts customers can configure must be separate, named objects in the model: choices are linked to those objects by name, and can show, hide or move them, or change their material.

= Do I still need product variations? =
No. A single product with a configurator replaces the variations and the images for every combination: customers pick their options and the preview is built from your layers or your 3D model. Prices, stock and SKUs per option are available with the Extra Price and Linked Products & Stock Management add-ons.

Variable products are supported too, if you need them: their variations can share one configurator or each have their own.

= Can several products share the same configurator? =
Yes, with global configurators. Build a configurator once under Product Configurator > Global configurators, or turn an existing product's configurator into a global one, then assign it to products or to whole product categories. A change made to a global configurator applies to every product using it, and any product can be detached with "Make local copy".

To share only part of a configurator, such as a fabric range, make a layer global and import it into other products.

= Does it work with my theme or page builder? =
Yes. By default the configurator opens from a "Configure" button that replaces the Add to cart button, which works with any WooCommerce theme. To embed the configurator in the product page, or anywhere else, use the `[mkl_configurator]` and `[mkl_configurator_button]` shortcodes in a block theme template, Elementor, Divi or any other page builder.

The configurator's look comes from its own themes, which you can pick and adjust in the settings and the WordPress Customizer.

= Can customers see the product in augmented reality? =
Yes, with the [3D Premium](https://wc-product-configurator.com/product/3d-premium-for-3d-product-configurator/) add-on. Customers on a phone or tablet get a "View in your space" button that places the product, as they configured it, in their room through the camera. It uses AR Quick Look on iPhone and iPad, and WebXR in Chrome on ARCore Android devices. The site must be served over HTTPS.

= How can I create a custom theme for the configurator? =
Use the starter theme, which you can find on <a href="https://github.com/marcusig/product-configurator-custom-theme">github</a> with simple instructions to get started.

= Is the product configurator compatible with WPML or Polylang? =
Yes, the plugin is compatible with both, and will add localization for the layer and choice fields.

= How can I optimize the layers in the configurator? =
We recommend using a plugin such as WP-Optimize for all-round performance improvements:
[vimeo https://vimeo.com/333705073]

= Which open source libraries does the plugin use? =
The product configurator plugin uses other Open Source libraries:

* PixiJS
* Three.js
* tippy and popper.js
* html2canvas.js
* download.js by dandavis
* Intervention/Image

Open Source SVG icons:

* Blender.org UI icons
* WordPress Gutenberg icons

== Screenshots ==

1. Configurator theme - Le Bolide
2. Configurator theme - Float
3. Configurator theme - Dark mode
4. Configurator theme - La Pomme
5. Configurator theme - WSB
6. Configurator theme - Float
7. Frontend default: replaces the Add to cart button by a "Configure" button
8. Configurator theme - Default
9. Configurator theme - Default opened
10. Configurator theme - Clean
11. Configurator theme - H
12. Frontend: configuration in the cart
13. Backend: configuration in the order
14. General plugin settings
15. WooCommerce product settings
16. Editing a configuration - home screen
17. Editing a configuration - Layers screen
18. Editing a configuration - Contents screen 
19. Editing a configuration - Contents screen editing


== Changelog ==

= 2.0.0 - unreleased =

* FEATURE: 3D configurator. Set a product's Configurator type to "3D configurator" to configure a glTF / GLB model: layers and choices are bound to named objects in the model, and show, hide, move or change the material of them. The scene supports HDRI and cubemap environments, six light types, eager or lazy model loading, and a camera position per view, which can be imported from the model's own cameras. Customers can rotate and zoom the model, including with the keyboard, and the cart, orders and quotes show a screenshot of the configured model
* FEATURE: Global layers. Turn any layer into a global layer with "Make Global", then import it into other products with "Import global layer". Products link to the shared layer, so a change made once with "Edit original" reaches every product using it, and "Disconnect from global layer" turns it back into a local layer on one product. Global layers are listed under Product Configurator > Global Layers
* FEATURE: Global configurators. A product's Configurator source can now be Local or Global: products set to Global share one configurator, stored under Product Configurator > Global configurators, so a change applies to all of them at once. Create one from scratch or with "Turn into global configurator", assign it per product or by product category (subcategories included), and use "Make local copy" to detach a single product
* FEATURE: Added a "Configuration meta data" setting, to store the configuration as one meta per layer instead of a single meta holding every choice. Individual metas are plain text, so exports, invoices and ERP integrations can read them without parsing markup
* PERFORMANCE: Added performance settings, grouping the caching, asynchronous loading and GZIP options in a new Performance section with two new options. "Only render the images the configurator is showing" keeps one image per layer in the viewer instead of one per choice, which makes large configurations lighter and angle changes faster (on for new installs, off for existing stores). "Clear cached configurations when a page cache is cleared" makes the purge triggered by WP Rocket, LiteSpeed Cache and WP-Optimize optional: it stays on, and turning it off avoids rebuilding every configuration at once when the page cache is cold
* TWEAK: The classic cart and checkout list one row per layer when the configuration is stored individually, to match the cart and checkout blocks
* DEV: Added `mkl_pc_get_configuration_meta_mode()` and the filter `mkl_pc/configuration_meta_mode`, to set the mode per product
* DEV: Added the filters `mkl_pc/order_created/individual_meta/key`, `mkl_pc/order_created/individual_meta/value` and `mkl_pc/order_created/individual_meta/keep_html`
* FIX: Cart items, orders and quotes now render the configuration image that was saved with them, instead of resolving it against the product's current configurator data. Editing a configurator no longer changes or breaks the image of configurations placed before the edit - including edits that renumber layer or choice IDs, such as turning a layer into a global one. The current data is still used as the fallback, for configurations saved without an image and for images that have since been deleted
* DEV: Added `MKL\PC\Choice::$source`, `set_source()` and `is_stored()`, to tell a configuration restored from a cart item, an order or a quote from one being configured right now
* FIX: Cart items, orders and quotes keep the layer and choice names they were saved with, instead of re-reading them from the product. Renaming a layer or a choice no longer rewrites configurations placed before the rename, and layers whose IDs changed no longer render as blank rows
* FIX: On multilingual sites, the saved layer and choice names are only used in the language the customer configured in. The admin now sees an order placed in another language with the product's own names, instead of the customer's translation: the order's Configuration is rebuilt in the admin's language - on the order page and in the admin emails TranslatePress sends in the admin's language, such as New order - while the customer's order pages and emails keep the one saved at checkout
* FIX: The same applies to the individual layer metas: they are displayed in the admin's language on the order page and in admin emails. Orders keep a hidden `_configurator_individual_meta` map of which layer each meta was made from
* DEV: The configurator saves the language with each choice (`lang`), and added `MKL\PC\Choice::saved_in_current_language()` and the filter `mkl_pc/choice/saved_in_current_language`
* FIX: Configurations now save the order their layers are composited in, so the stacking of the configuration image survives the product's layers being reordered. Configurations saved before this update keep the order the configurator saved them in, rather than having their layers scattered through the stack
* DEV: Added `MKL\PC\Choice::get_saved_image_id()`, `get_saved()` and `get_image_order()`, and the filters `mkl_pc/choice/image_id`, `mkl_pc/choice/source`, `mkl_pc/choice/saved_value` and `mkl_pc/choice/verify_saved_image`
* DEV: Added `MKL\PC\Utils::sort_layers_for_merging()`, replacing the three copies of the private `_order_images()` comparator, and the JS filter `PC.fe.save_data.parse_choices.image_order`

= 1.7.6 - 5/Oct/2026 =

* SECURITY: Prevent PHP object injection via configurator data — reject non-JSON saves and do not unserialize objects on read

= 1.7.5 - 11/Aug/2026 =

* TWEAK: Improve Mobile CSS in the theme Clean, reducing animations to improve performance
* TWEAK: Delay automatic close of choices after selection, to reduce simultaneous layout changes
* TWEAK: Fix inconsistent styling for the summary in Float, when using steps
* FIX: Prevent empty/broken media library entries when configuration image generation fails; reuse existing attachments when the file already exists

= 1.7.4 - 8/Jul/2026 =

* COMPAT: Restore configuration when accepting a YITH Request a Quote order (Premium)
* FIX: Configuration item data in WooCommerce cart and checkout blocks
* TWEAK: Improved cart block detection (Store API, plain permalinks)
* TWEAK: Include nonce when loading configurator data asynchronously
* TWEAK: Hide internal configurator meta from order item displays
* TWEAK: Choice thumbnail alt text includes layer and choice names
* TWEAK: Clarify disable caching setting when Stock Management add-on is active
* DEV: Added hooks for Addon Manager (`mkl_pc_addons_tab_before`, `mkl_pc_addon_card_actions`, `mkl_pc_addons_catalog`)
* DEV: Added `Frontend_Cart::restore_configuration_cart_item_data_from_order_item()` and `has_configuration_data()`

= 1.7.3 - 8/Jun/2026 =

* SECURITY: Restrict configurator data AJAX access to published products; non-published products require edit capability and a valid nonce

= 1.7.2 - 8/Jun/2026 =

* FEATURE: Setting to reset the configuration and quantity after Ajax add to cart
* TWEAK: Double check JSON decode
* FIX: Settings sanitizing braking setting containing link
* FIX: missing echo in screen reader text
* DEV: added function mkl_pc_get_configuration_price
* DEV: added PHP filter 'mkl_pc/reset_configurator_on_ajax_add_to_cart'
* DEV: added JS filter 'PC.fe.reset.on.ajax_add_to_cart'
* DEV: added JS action 'PC.fe.reset_after_ajax_add_to_cart'

= 1.7.1 - 11/May/2026 =

* UPGRADE: Upgraded Pixi to current version (v8)
* FIX: "Add to cart" language domain (removed context string)
* FIX: Add style attribute to kses_basic_inline_html 
* TWEAK: Fix add to cart validation (Validate before the item is added to the cart)
* DEV: Include security classes for rate limiting and token generation
* DEV: added JS action 'PC.fe.add_to_cart.append_ajax_request_body'
* DEV: added JS action 'PC.fe.add_to_cart.ajax_request_finally'

[See older changelog](https://plugins.trac.wordpress.org/browser/product-configurator-for-woocommerce/trunk/changelog.txt)

== Upgrade Notice ==

* 2.0.0 Major update: 3D configurator, global layers and global configurators. Configurator data moves to a new storage format, converted automatically. Back up your site before updating.
