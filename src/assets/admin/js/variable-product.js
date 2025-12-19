var PC = PC || {};
!( function ( $ ) {

	$( document ).ready( function () {
		var product_type = $( 'select#product-type' ).val();

		function variable_is_configurable() {
			$( this ).closest( '.woocommerce_variation' ).find( '.show_if_variation_is_configurable' ).hide();

			if ( $( this ).is( ':checked' ) ) {
				$( this ).closest( '.woocommerce_variation' ).find( '.show_if_variation_is_configurable' ).show();
			}
		}

		// Set the product type value when changing
		$( document.body ).on( 'woocommerce-product-type-change', function ( e, select_val, $el ) {
			product_type = select_val;
		} );

		$( '#_mkl_pc__variable_configuration_mode' ).on( 'change', function () {
			var mode = $( this ).val();
			if ( 'share_all_config' === mode || 'simple' === product_type ) {
				$( '#general_product_data .start_button_container' ).show();
				$( '#variable_product_options .start-configuration' ).hide();
			} else {
				$( '#general_product_data .start_button_container' ).hide();
				$( '#variable_product_options .start-configuration' ).show();
			}

			$( '._mkl_pc__all_variations_are_configurable_field' ).toggle( 'share_all_config' === mode && 'variable' === product_type );
		} );

		$( '#_mkl_pc__variable_configuration_mode' ).trigger( 'change' );

		$( '#woocommerce-product-data' ).on( 'woocommerce_variations_loaded', function () {

			var inputs = $( 'input.variable_is_configurable' );

			inputs.each( function ( index, el ) {
				if ( !$( el ).is( ':checked' ) ) {
					$( el ).closest( '.woocommerce_variation' ).find( '.show_if_variation_is_configurable' ).hide();
				}
				// variable_is_configurable
			} ).on( 'change', variable_is_configurable );

			// action = $('input.variable_is_configurable').is(':checked');

			// '.show_if_variation_is_configurable'

			$( '.woocommerce_variation .start-configuration' ).on( 'click', function ( event ) {
				// console.log(PC.app);
				event.preventDefault();
				// this.
				var product_id = $( this ).data( 'product-id' );
				var parent_id = $( this ).data( 'parent-id' );
				PC.app.start( {
					product_id: product_id,
					product_type: 'variation',
					parent_id: parent_id
				} );
			} );

			$( '#_mkl_pc__variable_configuration_mode' ).trigger( 'change' );

		} );

	} );

} )( jQuery );
