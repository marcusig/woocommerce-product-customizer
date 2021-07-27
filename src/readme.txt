=== Product Configurator for WooCommerce ===
Contributors: mklacroix, marcusig
Tags: woocommerce,customize,product addons,configure
Donate link: https://paypal.me/marclacro1x
Requires at least: 4.2
Tested up to: 5.8
Stable tag: 1.2.16
Requires PHP: 5.6
License: GPLv2+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Allow your customers to create configurable products with a live preview of the result. Works using a system of layers.

== Description ==

The Product Configurator for WooCommerce allows you to use layers to produce instant visuals for your customers.

Give your customers a great experience, and make your life easy: no need to create many product variations with their images. 

Instead, export your layers from Photoshop, a 3D render, or any other source, and allow the user to configure their product using those.

<a href="http://demos.mklacroix.com/shop/custom-chair/">Basic demo</a>

<a href="http://demos.mklacroix.com/configurable-watch/">Inline demo</a>

<a href="http://demos.mklacroix.com/addons/product/super-sneakers/">Basic demo with all addons</a>

You can report bugs or suggestions on the <a href="https://github.com/marcusig/woocommerce-product-customizer/issues">github repository</a> or the <a href="https://wordpress.org/support/plugin/product-configurator-for-woocommerce/">support forum</a>.

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
2. Unzip the zip file, which will extract the wp-optimize directory to your computer
3. Upload the wp-optimize directory to the /wp-content/plugins/ directory in your web space
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
7. Frontend: configuring a product
8. Frontend: configuring a product
9. Frontend: configuration in the cart
10. Backend: configuration in the order
11. General plugin settings

== Changelog ==

= 1.2.16 - 27/Jul/2021 =

* FEATURE: Possibility to use HTML [instead of / with] images
* TWEAK: Load generated images asynchronously
* TWEAK: Translate the Selected choice
* TWEAK: Various multi-currency tweaks
* TWEAK: Added various filters and tweaks
* TWEAK: Add compatibility with "Yith Added to cart popup"
* TWEAK: Refactor configuration display in the order

= 1.2.15 - 09/Jun/2021 =

* TWEAK: Admin - Possibility to select and delete several items at a time, using ctrl or shift + click
* TWEAK: Tweak admin z-index for compatibility with Divi
* TWEAK: Do not Gzip content on LiteSpeed servers
* TWEAK: Prevent Required field error to be shown when a layer is hidden by conditional logic action

= 1.2.14 - 17/May/2021 =

* FIX: Error in compatibility with Price Based on Country
* TWEAK: Enqueue PIXIjs

= 1.2.13 - 10/May/2021 =

* NEW THEME: Introducing the new H theme
* TWEAK: Compatibility with Price Based on Country
* TWEAK: Compatibility with GTranslate Premium
* TWEAK: Make sure the existing thumbnail is fetched
* TWEAK: Fix close button position on some themes
* TWEAK: Fix image order in the cart

= 1.2.12 - 7/Apr/2021 =

* TWEAK: Layer and choice names to support basic HTML
* TWEAK: Only use cached configuration when a user is not admin
* FIX: Fix header styling in several themes on mobile devices

= 1.2.11 - 7/Apr/2021 =

* FIX: Duplicating layers kept the link between the images
* FIX: Reordering images didn't always work as expected

= 1.2.10 - 5/Apr/2021 =

* FEATURE: Possibility to duplicate layers and content
* FEATURE: Possibility to make a layer selection mendatory
* TWEAK: Show configuration image in order email and admin
* TWEAK: Added the possibility to specify the tag of the "Configure" button when using the shortcode: use `tag="link"` or `tag="a"` to use a link instead of a button.
* FIX: Fix memory leak when adding choices in the admin

= 1.2.9 - 17/Mar/2021 =

* FIX: Enabling groups in a choice re-renders the choices list in the admin
* TWEAK: Cache purge required after update

= 1.2.8 - 17/Mar/2021 =

* FEATURE: Added the possibility to enter custom HTML for layers defined as "not a choice"
* FEATURE: Added the possibility to order the images and menu items separately
* COMPAT: Added compatibility with [Quotes for WooCommerce](https://wordpress.org/plugins/quotes-for-woocommerce/)
* TWEAK: Added a setting to change the location of the Configure button
* TWEAK: Indicate when images are loading
* TWEAK: Add the ability to not use the tooltip for the description, but instead always show it.
* TWEAK: Added the possibility to change angle depending on the active layer / choice

= 1.2.7 - 02/Feb/2021 =

* FEATURE: Added the possibility to group choices
* FEATURE: The plugin is now multilingual: added compatibility with WPML and Polylang 
* FEATURE: Multi currency: Added compatibility with [WooCommerce Currency Selector (WOOCS)](https://wordpress.org/plugins/woocommerce-currency-switcher/), WCML, Aelia currency switcher
* TWEAK: Added the missing add-ons in the settings
* TWEAK: Added layer admin label, to facilitate conditional logic usage

= 1.2.6 - 12/Jan/2021 =

* FEATURE: Added controls to the theme customizer to change selected colors and background image
* FEATURE: Load configuration when pressing on the cart link
* TWEAK: Add compatibility for multiple choice limits

= 1.2.5 - 29/Dec/2020 =

* TWEAK: Prevent error when no choice is available

= 1.2.4 - 18/Dec/2020 =

* TWEAK: Improve Dark Mode theme mobile styling
* TWEAK: Add a new setting, to close the choices when selecting one on mobile
* TWEAK: Add more hooks

= 1.2.3 - 30/Nov/2020 =

* FIX: Fixed cache purge function
* TWEAK: Add the possibility to close the configurator when pressing "add to cart". Useful when using ajax to submit the form.

= 1.2.1 - 7/Nov/2020 =

* TWEAK: Fix custom theme registration system
* TWEAK: Fix padding in WSB theme

= 1.2.0 - 6/Nov/2020 =

* FEATURE: Added the possibility to display the description in the layer or choice buttons.
* FEATURE: Added themes - you can now choose between 4 designs for your configurator (the default and 3 new themes)! 
* FEATURE: Added an "inline" configurator shortcode. 
* TWEAK: Possibility to add html classes to the choices

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

* 1.2.16 adds new hooks and various tweaks as well as the possibility to use custom HTML instead of regular image content. Added the possibility to select and delete several items at a time in the admin.



