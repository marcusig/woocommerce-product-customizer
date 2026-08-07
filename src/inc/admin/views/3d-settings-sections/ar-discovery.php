<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$addon_name = __( '3D Premium Features', 'product-configurator-for-woocommerce' );
$addon_url  = apply_filters( 'mkl_pc_3d_premium_addon_url', 'https://wc-product-configurator.com/' );
?>
<div class="addon-setting-info pc-3d-ar-discovery add-on-placeholder">
	<span class="pc-3d-ar-discovery__icon" aria-hidden="true"><?php echo mkl_pc_include_svg_icon( '3d/view_in_ar' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- SVG markup. ?></span>
	<p>
		<?php
		echo wp_kses_post(
			sprintf(
				/* translators: 1: add-on name, 2: opening link tag, 3: closing link tag */
				_x( '%1$s is available as %2$san add-on%3$s.', 'First placeholder is the add-on name, second and third are the link tags to the add-on', 'product-configurator-for-woocommerce' ),
				esc_html( $addon_name ),
				'<a href="' . esc_url( $addon_url ) . '" target="_blank" rel="noopener noreferrer" class="mkl-pc-link--external">',
				'</a>'
			)
		);
		?>
	</p>
	<p><?php esc_html_e( 'Let customers open the configured product in AR on supported mobile devices (iOS Quick Look and Android WebXR).', 'product-configurator-for-woocommerce' ); ?></p>
	<p><a href="#" class="hide-addon-placeholder" data-setting="ar_placeholder" data-section="ar"><?php esc_html_e( 'Hide this notice', 'product-configurator-for-woocommerce' ); ?></a></p>
</div>
