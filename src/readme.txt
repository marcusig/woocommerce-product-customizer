=== Product Configurator for WooCommerce ===
Contributors: mklacroix, marcusig
Tags: woocommerce,customize,product addons,custom product, product builder
Donate link: https://paypal.me/marclacro1x
Requires at least: 5.9
Tested up to: 6.9
Stable tag: 1.5.10
Requires PHP: 7.4
License: GPLv2+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Allow your customers to create configurable products with a live preview of the result. Works using a layer-based system.

== Description ==

**Product Configurator for WooCommerce** allows you to use transparent image layers to build real-time visual previews of custom products.

Give your customers an interactive experience and eliminate the need for hundreds of product variations and images. Export image layers from Photoshop, 3D renders, or other sources, and let the user assemble their product dynamically—no need for technical skills or bulky setups.

Whether you're customizing jewelry, watches, clothing, furniture, or electronics, this plugin lets you offer flexible configuration options while keeping your store lightweight and manageable.

Easily add a product configurator to WordPress, with the plugin Product Configurator for Woo!

🎮 [Check out the live demos](http://demos.mklacroix.com/)  
🛠️ [Set up a sandbox with admin access](http://demos.mklacroix.com/wp-signup.php)

Have feedback, ideas, or found a bug? Report issues on [GitHub](https://github.com/marcusig/woocommerce-product-customizer/issues) or use the [support forum](https://wordpress.org/support/plugin/product-configurator-for-woocommerce/).

=== Features ===

* **🖼️ Layered Image Rendering** – Compose product previews using transparent PNG layers—no need to create images for every combination.
* **🔄 Multiple Views** – Show multiple angles or perspectives (e.g., front, side, back) of the product.
* **📋 Multi-Step Configurator** – Split complex product builds into multiple steps to streamline user experience.
* **💰 Price per Option** *(via add-on)* – Assign additional pricing to individual options (great for premium upgrades).
* **📝 Form Fields** *(via add-on)* – Let users enter text, numbers, or upload files—ideal for personalized orders.
* **🧮 Custom Pricing Formulas** *(via add-on)* – Calculate advanced prices dynamically based on user input and selected options.
* **🔀 Conditional Logic** *(via add-on)* – Show/hide options dynamically depending on user selections—perfect for complex logic flows.
* **📦 Inventory & Stock Management** *(via add-on)* – Track inventory per option inside the configurator, or by linking to actual WooCommerce products.
* **🔗 Linked Products** *(via add-on)* – Link any configurator choice to a real product in your WooCommerce shop:
  * Add real components to the cart
  * Track SKUs and inventory
  * Support ERP/warehouse integration
  * Build composite/bundled products
  * Use or override linked product pricing
* **🔤 Live Text Overlay** *(via add-on)* – Let customers preview custom text with your fonts and colors—ideal for engraving, embroidery, and personalization.
* **🧑‍💻 Developer Friendly** – Includes hooks, filters, and a clean, commented codebase. Limited docs for now, but open support is available.

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

=== Premium Add-ons ===

The core plugin is fully functional. Extend it with these premium modules:

* [**Extra Price**](https://wc-product-configurator.com/product/extra-price/) – Add custom pricing to options  
* [**Save Your Design**](https://wc-product-configurator.com/product/save-your-design/) – Let users save and return to their designs  
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

[youtube https://www.youtube.com/watch?v=qz8L-hMJnKs]
Not enough? Ask your questions <a href="https://wordpress.org/support/plugin/product-configurator-for-woocommerce/">on the support forum</a>

= How can I create a custom theme for the configurator? =
Use the starter theme, which you can find on <a href="https://github.com/marcusig/product-configurator-custom-theme">github</a> with simple instructions to get started.

= Is the product configurator compatible with WPML or Polylang? =
Yes, the plugin is compatible with both, and will add localization for the layer and choice fields.

= How can I optimize the layers in the configurator? =
We recommend using a plugin such as WP-Optimize for all-round performance improvements:
[vimeo https://vimeo.com/333705073]

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

* TWEAK: Fix ajax add to cart modal position on La Pomme
* TWEAK: Hide Stripe express checkout on configurable products, to prevent adding to the cart without configuring
* TWEAK: Throw error when adding product to the cart without configuration
* FIX: Variable products not adding to the cart when using the Ajax ATC feature
* FIX: issue on some variable products

= 1.5.10 - 15/Dec/2025 =

* TWEAK: Moved error message CSS to common CSS
* DEV: Filter 'PC.fe.cart_redirect_url'
* DEV: Added filter Filter 'PC.fe.cart_redirect_after_add'
* TWEAK: Added a setting to show "View configuration" link in the order
* TWEAK: Added a setting to show "Edit configuration" link in the cart and checkout

= 1.5.9 - 1/Dec/2025 =

* Compatibility with Tiered price plugin
* Compatibility with Wholesale price - tiered prices
* PERFORMANCE: Possibility to load configurator data asynchronously
* Tested up to 6.9

= 1.5.8 - 3/Nov/2025 =

* FIX: Choice class to initiate when calling the get method, or some data can be missing in some instances

= 1.5.6 - 22/Oct/2025 =

* FIX: Check for missing dependency (accounting.js)
* TWEAK: Include both color and image in choice thumbnails

= 1.5.5 - 13/Oct/2025 =

* COMPATIBILITY: WooCommerce Currency Switcher (Curcy) - cache compat
* FEATURE: added setting to control per layer whether to close a layer when the user makes a selection
* TWEAK: Automatically wrap custom html when necessary (Layer > Custom HTML)
* TWEAK: Purge configurator cache when litespeed_purged_all is triggered
* TWEAK: Added JS action 'PC.fe.configurator.summary.render'
* TWEAK: Summary to use template function, allowing to add content using PHP hooks
* TWEAK: Add setting Image size used when merging images
* FIX: Save your design modal positioning in WSB theme on mobile
* FIX: dropdown position in La Pomme and Le Bolide

= 1.5.3 - 16/Sep/2025 = 

* FIX: Issue with image from wrong angle used in image generation
* FIX: compatibility with Quotes for WooCommerce label not working after update
* TWEAK: added filter mkl_pc/display_add_to_cart_button

= 1.5.2 - 3/Sep/2025 = 

* PERFORMANCE: Multiple views data only included if images are present
* TWEAK: possibility to re-order views without loosing the thumbnails set in choices

= 1.5.1 - 31/Jul/2025 = 

* TWEAK: Parse conditions on import (compatibility with latest Conditional logic add-on)
* Fix: Data issue when only one choice exists in a layer
* FIX: Default settings overriding selection when saving the configurator settings

= 1.5.0 - 15/Jul/2025 = 

* FEATURE: Added compatibility with Variable products, previously available as an add-on.
* SECURITY: Prevent possible Cross Site Request Forgery, which would allow purging configuration cache if executed - credit to Nguyen Xuan Chien for the discovery
* TWEAK: Set default options when first installing the plugin
* TWEAK: Improved accessibility on the Frontend, for keyboard navigation and voice over.
* DEV: Refactored copy / paste functionality to work with paste event instead of reading the clipboard data directly
* DEV: include Button object in added_to_cart event
* TWEAK: Prevent error when a parent group was deleted without removing children first

= 1.4.4 - 13/Jun/2025 = 

* COMPATIBILITY: prepared compatibility with upcoming text overlay add-on
* COMPATIBILITY: improved compatibility with WooCommerce Wholesale pricing
* TWEAK: Add color picker to Color field
* TWEAK: Automatic purge with WP-Optimize and WP-Rocket purging
* TWEAK: Bolide inline style tweaks
* TWEAK: Float theme CSS tweaks
* DEV: Add repeater field type in layer / choice settings
* DEV: Add JS filter `PC.fe.viewer.main_view`
* DEV: Add JS action `PC.fe.models.layer.init`
* DEV: Add JS action `PC.fe.angle_view.init` to trigger in Conditional logic

= 1.4.3 - 9/May/2025 = 

* FIX: In some cases, when the configuration contains only one image, the attachment would be saved again and again. Not duplicating the file, but the post.
* TWEAK: Added navigation history in the settings page, to allow staying on the same setting section when saving / refreshing

= 1.4.2 - 6/May/2025 = 

* FIX: Compatibility issue with Variable products, where selected data was not visible in the cart

= 1.4.1 - 1/May/2025 = 

* FIX: Possible Fatal error when wp_generate_attachment_metadata did not exist
* TWEAK: Configuration image generation does not use transients anymore

= 1.4.0 - 14/Apr/2025 = 

* DEV: Added action 'mkl_pc/yith-raq/added_product' (Yith RAQ compatibility)
* DEV: Do not use transients when saving image
* DEV: Compatibility with Save your design new "Share" feature
* DEV: Include updater class for access by the addons
* PERFORMANCE: Attempt at reducing memory usage in cart: only load content in class when required when unserializing MKL\PC\Choice
* TWEAK: Made string 'Successfully added to cart, now redirecting...' translatable, and added a setting to override it
* TWEAK: Show weight on number and quantity fields
* TWEAK: Changed setting label "Make all steps clickable..." for more clarity
* FEATURE: Add view parameter to URL and shortcode

= 1.3.11 - 16/Feb/2025 = 

* FIX: Error when adding to the cart in some situations
* TWEAK: Base styling for themes which adds +/- buttons

= 1.3.10 - 14/Feb/2025 = 

* BETA FEATURE: Elementor configuration fields
* FIX: Compatibility with Astra and other themes with 2 cart forms on the page, which might add the product to the cart twice when using Ajax 
* TWEAK: load_plugin_textdomain at init instead of plugins_loaded
* TWEAK: Fix issue with ajax add to cart not working on shortcodes
* TWEAK: Better log when setConfig fails
* TWEAK: Clean: word break on buttons
* TWEAK: Summary - add choice class and form item field-id as data attribute
* TWEAK: Ajax add to cart - Log error instead of alerting it

= 1.3.9 - 18/Nov/2024 = 

* FEATURE: Custom Ajax Add to cart 
* FIX: display issue in fullscreen layer with groups (Float theme)

= 1.3.8 - 13/Nov/2024 = 

* Tested with WP 6.7
* FEATURE: Possibility to copy and paste content from one layer to an other, or to an other product
* Float theme: Fix toggled display when steps are enabled
* Admin - Cleanup selection when editing a different set of choices, to prevent issues when grouping / copying items
* Fix out of stock label in tooltip (Float theme)

= 1.3.7 - 17/Oct/2024 = 

* FEATURE: Added Full screen display mode (only available in the Float theme to start with)
* TWEAK: Added filter mkl_pc/wc_cart_add_item_data/choice_weight - allows changing the weight of a single choice. Used by the Form field add-on
* TWEAK: Added filter mkl_pc/wc_cart_get_item_data/display_choice_image - allows disabling the choice thumbnails in the cart and checkout
* TWEAK: Enable "Color hex code" field on all display modes, instead of only Color swatches

= 1.3.6 - 17/Jul/2024 = 

* Tested with WP 6.6
* TWEAK: Choices: Do not save angle data in the choices
* TWEAK: Maybe wrap custom_html when rendering the content
* TWEAK: Do not limit summary usage to themes supporting steps
* TWEAK: Move PC.fe.summary_item.attributes filter to Form fields addon
* TWEAK: Only have weight on normal choices, not form field choices
* TWEAK: [Admin] Possibility to add layers between others (Beta)
* TWEAK: [Admin] render choices when duplicating items, to display in the right order
* TWEAK: [Admin] tweak multiple selection
* TWEAK: Fix SKU not showing if it's set to 0
* TWEAK: Add svg sprite, to have all icons in one place
* TWEAK: Add JS hook PC.admin.layer_form.render
* TWEAK: Fix typo in Bolide theme JS, preventing the "scroll to top" to happen when changing steps
* TWEAK: Improve compatibility with YITH Request a Quote Premium - include configuration data when adding from the cart 
* FIX: Fix CSS issue in Dark mode, where the viewer would disappear at a certain screen size

= 1.3.5 - 3/Jun/2024 = 

* FIX: Performance issue in block cart compatibility
* TWEAK: Fix scroll to top in Le Bolide + Steps
* TWEAK: Added setting to hide layer in the summary

= 1.3.4 - 15/May/2024 = 

* TWEAK: Add fallback dimensions when generating the configurator image and the image size is set to 0x0
* FIX: Link to edit configuration in the YITH Request a quote form to actually load the configuration
* TWEAK: Added JS action 'PC.fe.setContent.parse.before'
* TWEAK: Configuration image added to the block cart
* TWEAK: Multi currency: regular_price to be stored in main currency
* TWEAK: Reset steps when reseting configurator
* TWEAK: Do not trigger a Required error when "The user can deselect the current choice" is enabled and Required is not selected
* TWEAK: Prevent Warning in image generation
* FIX: Fix layer name background color on Dark mode theme

= 1.3.3 - 23/Apr/2024 = 

* FIX: Typo in function causing JS error in some cases

= 1.3.2 - 23/Apr/2024 = 

* TWEAK: Hide the layer in the summary, following the settings "Hide in cart" and "Hide in the menu"
* TWEAK: Add setting "Make all steps clickable in the breadcrumb"
* DEV: Added filter (JS) PC.fe.selected_choice.name, which allows overriding the name displayed
* DEV: Added action (PHP) mkl-pc-configurator-choices--after, executed at the end of the choices list template
* FIX: YITH add to quote not working with single quotes, needed to wp_unslash the raw data
* FIX: Large color swatch label

= 1.3.1 - 2/Apr/2024 = 

* Tested up to 6.5
* Bump minimum WordPress required version
* TWEAK: Ignore groups with no selected item when adding to cart
* TWEAK: Summary: Hide in configurator
* TWEAK: added filter PC.fe.steps.display_breadcrumb to prevent display of breadcrumb in the steps mode
* TWEAK: added filter PC.fe.steps.display_breadcrumb to prevent display of breadcrumb in the steps mode
* FIX: Compatibilty with YITH Quote request, where the configurator data would not be added in some instances.

= 1.3.0 - 17/Feb/2024 = 

* FEATURE: Added an new theme Le Bolide
* FEATURE: Added the possibility for step by step progression for a selection of configurator themes. 
* FEATURE: Added the possibility to change the layout in some configurator themes. Whether the number of columns or the size of color swatches.
* NEW: Updated the admin UI
* COMPATIBILITY: Botiga compatibility: quantity input layout, and +/- buttons 	
* TWEAK: Generated image in the cart defaults to product image when generation fails
* TWEAK: Add live preview to the Customizer options
* TWEAK: Default theme is now part of the themes list
* TWEAK: Removed "add to cart modal" from WSB anf Float, and changed the layout to accomodate all the content
* TWEAK: Added timeout setting for admin requests
* TWEAK: Ajax add to cart support, for themes and plugins using the `adding_to_cart` and `added_to_cart` events

[See older changelog](https://plugins.trac.wordpress.org/browser/product-configurator-for-woocommerce/trunk/changelog.txt)

== Upgrade Notice ==

* 1.5.10 Minor tweaks and fixes