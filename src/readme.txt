=== Product Configurator for WooCommerce ===
Contributors: mklacroix, marcusig
Tags: woocommerce,customize,product addons,configure
Donate link: https://paypal.me/marclacro1x
Requires at least: 4.2
Tested up to: 5.5
Stable tag: 1.1.2
Requires PHP: 5.6
License: GPLv2+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Allow your customers to create configurable products with a live preview of the result. Works using a system of layers.

== Description ==

The Product Configurator for WooCommerce allows you to use layers to produce instant visuals for your customers.

Give your customers a great experience, and make your life easy: no need to create many product variations with their images. 

Instead, export your layers from Photoshop, a 3D render, or any other source, and allow the user to configure their product using those.

<a href="http://demos.mklacroix.com/shop/custom-chair/">Try the demo</a>

You can report bugs or suggestions on the <a href="https://github.com/marcusig/woocommerce-product-customizer/issues">github repository</a> or the <a href="https://wordpress.org/support/plugin/product-configurator-for-woocommerce/">support forum</a>.

**Available shortcodes**

* Configure button: `[mkl_configurator_button product_id=1 classes="button primary"]` or [mkl_configurator_button product_id=1 classes="button primary"]Button name[/mkl_configurator_button]
* **[NEW]** Inline configurator: `[mkl_configurator product_id=1 classes="container-class something-else"]`

**Premium addons**

This plugin comes without limitations. But if you need more functionalities, look at the available addons: 

* <a target="_blank" href="https://wc-product-configurator.com/product/extra-price/">Extra Price</a> - Add an extra cost to any of the choices you offer in your configurable products.
* <a target="_blank" href="https://wc-product-configurator.com/product/save-your-design/">Save your design</a> - Get your customers engaged by enabling them to save the design they’ve made.
* <a target="_blank" href="https://wc-product-configurator.com/product/variable-products/">Variable products</a> - Use the product configurator with variable products.
* <a target="_blank" href="https://wc-product-configurator.com/product/multiple-choice/">Multiple choices</a> - Enables multiple choices per layer Ideal for a product’s options, or when having several individual options.
* <a target="_blank" href="https://wc-product-configurator.com/product/stock-management-and-linked-product/">Stock management / Linked product</a> - Manage the stocks on a choice basis, or link a choice to a product in the shop. 
* For custom needs, contact me <a href="https://wc-product-configurator.com/contact/">here</a>

== Installation ==

There are 3 different ways to install this plugin, as with any other wordpress.org plugin.

= Using the WordPress dashboard =

1. Navigate to the 'Add New' in the plugins dashboard
2. Search for 'Product Configurator for WooCommerce'
3. Click 'Install Now'
4. Activate the plugin on the Plugin dashboard

= Uploading in WordPress Dashboard =

1. Download the latest version of this plugin
2. Navigate to the 'Add New' in the plugins dashboard
3. Navigate to the 'Upload' area
4. Select the zip file (from step 1.) from your computer
5. Click 'Install Now'
6. Activate the plugin in the Plugin dashboard

= Using FTP =

1. Download the latest version of this plugin from https://wordpress.org/plugins/
2. Unzip the zip file, which will extract the wp-optimize directory to your computer
3. Upload the wp-optimize directory to the /wp-content/plugins/ directory in your web space
4. Activate the plugin in the Plugin dashboard

== Frequently Asked Questions ==

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
7. Frontend: configuring a product
8. Frontend: configuring a product
9. Frontend: configuration in the cart
10. Backend: configuration in the order
11. General plugin settings

== Changelog ==

* FEATURE: Added the possibility to display the description in the layer or choice buttons.
* FEATURE: Added an "inline" configurator shortcode. 

= 1.1.2 - 1/Oct/2020 =

* FIX: Fixed data issue
* TWEAK: Possibility to add a custom html class for each layer
* TWEAK: Show configuration image in the cart / checkout
* TWEAK: Better multisite support
* TWEAK: Better error handling when saving the product's data
* TWEAK: Show the product's price in the modal
* TWEAK: Use hooks in sidebar template

= 1.1.1 - 04/Sep/2020 =

* Fix multiple choice select in the admin

= 1.1.0 - 02/Sep/2020 =

* FEATURE: Added shortcode, enabling to configure a product from anywhere.
* TWEAK: Compatibility with `wp.hooks` included in WP core
* TWEAK: Better cache handling (added the ability to manually clear the cache from the settings, and regenerate when saving the product)

= 1.0.10 - 31/July/2020 =

* TWEAK: Added a setting to customize the label of the "Configure" button
* TWEAK: Prevent JS error when no choice is set for a layer

= 1.0.9 - 15/July/2020 =

* TWEAK: Tweak mobile design
* TWEAK: Fix keyboard event on layer inputs
* TWEAK: Ability to remove images
* TWEAK: Add links to support and reviews

= 1.0.8 - 05/July/2020 =

* TWEAK: Fix angles not changing
* TWEAK: Fix JS error

= 1.0.7 - 04/July/2020 =

* TWEAK: Fix JS error in admin

= 1.0.6 - 03/July/2020 =

* TWEAK: Refactor layer settings to be filterable
* TWEAK: Refactor choices to allow multiple choices addon
* TWEAK: Display all the images to allow transitioning between two
* TWEAK: Code cleanup

= 1.0.5 - 10/June/2020 =

* TWEAK: Each product now uses a unique key when enqueuing the data

= 1.0.3 - 08/April/2020 =

* FIX: Fix saving issue when just adding an item
* TWEAK: Fix activation on multisite

= 1.0.2 - 25/March/2020 =

* TWEAK: Add addons tab

= 1.0.1 - 23/March/2020 =

* FIX: Change path where product configuration cache is saved to avoid blocked access

== Upgrade Notice ==

* 1.1.2 IMPORTANT: This version updates the configuratior's data, so it is recommended to backup the database first. It also adds the ability to show the configuration image instead of the default product image in the cart and checkout pages.

