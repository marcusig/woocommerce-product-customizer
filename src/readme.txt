=== Product Configurator for WooCommerce ===
Contributors: mklacroix, marcusig
Tags: woocommerce,customize,product addons,configure
Donate link: https://paypal.me/marclacro1x
Requires at least: 5.9
Tested up to: 6.7
Stable tag: 1.3.7
Requires PHP: 7.4
License: GPLv2+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Allow your customers to create configurable products with a live preview of the result. Works using a system of layers.

== Description ==

The Product Configurator for WooCommerce allows you to use layers to produce instant visuals for your customers.

Give your customers a great experience, and make your life easy: no need to create many product variations with their images. 

Instead, export your layers from Photoshop, a 3D render, or any other source, and allow the user to configure their product using those.

Easily add a product configurator to WordPress, with the plugin Product Configurator for Woo!

<a href="http://demos.mklacroix.com/">Check out the demos here</a>

You can report bugs or suggestions on the <a href="https://github.com/marcusig/woocommerce-product-customizer/issues">github repository</a> or the <a href="https://wordpress.org/support/plugin/product-configurator-for-woocommerce/">support forum</a>.

**Features**

* Layers: The configurator viewer uses transparent images as layers to create the final product image
* Multiple views: Display the different parts of your products using the multiple views feature
* Multiple steps: Selling complex products? Split your configurator in different steps to make the process easier to understand for your customers.
* Price per option: Charge an additional price for each option that requires it (requires an add-on).
* Form fields: Let your user input data such as text or numbers, as well as send files with their configuration (requires an add-on).
* Calculate complex prices with custom formulas (requires Extra-price and Form fields add-ons)
* Conditional logic: Build complex products, hide or show elements dynamically depending on previous selection or other parameters (requires an add-on).
* Stock management: Manage stock of your configurator items, directly in the configurator, or by linking other products in the shop (requires an add-on).
* Linked products: Link other products in your shop to choices in the configurator. They can be added to the cart to build bundles or complex composite products. Useful for example when linking to an external ERP software (requires an add-on).
* Developer friendly: The configurator and the add-ons all have plenty hooks to extend or modify or add features. While the dev documentation is currently limited, the code source is commented, and you are welcome to open a support request to get guidance would you require.

**Available shortcodes**

* Configure button: `[mkl_configurator_button product_id=1 classes="button primary"]` or [mkl_configurator_button product_id=1 classes="button primary"]Button name[/mkl_configurator_button]
* Inline configurator: `[mkl_configurator product_id=1 classes="container-class something-else"]`

**Themes**

* Choose between different themes, or create your own (developer friendly)
* Change selected colors using the theme Customizer (Appearance > Customize)

**Premium addons**

This plugin comes without limitations. But if you need more functionalities, look at the available addons: 

* <a target="_blank" href="https://wc-product-configurator.com/product/extra-price/">Extra Price</a> - Add an extra cost to any of the choices you offer in your configurable products.
* <a target="_blank" href="https://wc-product-configurator.com/product/save-your-design/">Save your design</a> - Get your customers engaged by enabling them to save the design they’ve made.
* <a target="_blank" href="https://wc-product-configurator.com/product/variable-products/">Variable products</a> - Use the product configurator with variable products.
* <a target="_blank" href="https://wc-product-configurator.com/product/multiple-choice/">Multiple choices</a> - Enables multiple choices per layer Ideal for a product’s options, or when having several individual options.
* <a target="_blank" href="https://wc-product-configurator.com/product/stock-management-and-linked-product/">Stock management / Linked product</a> - Manage the stocks on a choice basis, or link a choice to a product in the shop. 
* <a target="_blank" href="https://wc-product-configurator.com/product/conditional-logic/">Conditional logic</a> - Manage the stocks on a choice basis, or link a choice to a product in the shop. 
* <a target="_blank" href="https://wc-product-configurator.com/product/form-fields/">Form fields</a> - Create forms to collect data associated to your configurable products. Perform complex price calculations in combination with the Extra price add-on.
* For custom needs, contact me <a href="https://wc-product-configurator.com/contact/">here</a>

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

1. WooCommerce product settings
2. Editing a configuration - home screen
3. Editing a configuration - Layers screen
4. Editing a configuration - Contents screen 
5. Editing a configuration - Contents screen editing
6. Frontend default: replaces the Add to cart button by a "Configure" button
7. Frontend: configuring a product - Default theme
8. Frontend: configuring a product
9. Frontend: configuration in the cart
10. Backend: configuration in the order
11. General plugin settings
12. Configurator theme - Clean
13. Configurator theme - Dark mode
14. Configurator theme - Float
15. Configurator theme - H
16. Configurator theme - La Pomme
17. Configurator theme - WSB

== Changelog ==

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

* 1.3.7 Various tweaks and improvements, added Full screen display mode (only available in the Float theme to start with)