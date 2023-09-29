( function( $ ) {

	// Price Based on Country Rate
	function get_choice_price( extra_price, choice ) {

		// If we have a specific price for this item and zone, use it 
		if ( 'linked' === choice.get( 'manage_stock' ) && PC_config.config.wcpbc_zone_id && 'undefined' != typeof choice.get( 'extra_price_zone_' + PC_config.config.wcpbc_zone_id ) ) {
			console.log( 'pc.get_extra_price ZID set', choice.get( 'extra_price_zone_' + PC_config.config.wcpbc_zone_id ) );
			return parseFloat( choice.get( 'extra_price_zone_' + PC_config.config.wcpbc_zone_id ) );
		}

		// Otherwise use the rate
		if ( 'undefined' != typeof PC.fe.config.wcpbc_rate && parseFloat( PC.fe.config.wcpbc_rate ) ) {
			var converted = extra_price * parseFloat( PC.fe.config.wcpbc_rate );
			if ( PC.fe.config.wcpbc_round_nearest ) {
				converted = Math.ceil( converted / PC.fe.config.wcpbc_round_nearest ) * PC.fe.config.wcpbc_round_nearest;
			}
			console.log( 'converted at rate', PC.fe.config.wcpbc_rate, choice.get( 'name' ), extra_price );
			return converted;
		}
		console.log( 'no change', PC.fe.config.wcpbc_rate );
		return extra_price
	}

	wp.hooks.addFilter( 'pc.get_extra_price', 'mkl_pc.compat.wcpbc', get_choice_price );
	wp.hooks.addFilter( 'PC.fe.extra_price.item_price', 'mkl_pc.compat.wcpbc', get_choice_price );
	

} )( jQuery );
