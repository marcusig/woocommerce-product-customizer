PC.utils = PC.utils || {
	_isTouch: function() {
		// var isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|playbook|silk|BlackBerry|BB10|Windows Phone|Tizen|Bada|webOS|IEMobile|Opera Mini)/),
			var isTouch = (('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0) || (navigator.maxTouchPoints));
		return isTouch;
	},
	_isMobile: function() {
		var isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|playbook|silk|BlackBerry|BB10|Windows Phone|Tizen|Bada|webOS|IEMobile|Opera Mini)/);
		return !! isTouchDevice;
	},
	formatMoney: function ( amount, convert ) {
		if ( 'undefined' === typeof convert ) convert = true;
		if ( convert ) {
			amount = this.maybeConvertAmountToCurrency( amount );
		}
		if ( 'undefined' === typeof accounting ) return amount;
		return accounting.formatMoney( amount, {
			precision: PC_config.lang.money_precision,
			symbol: PC_config.lang.money_symbol,
			decimal: PC_config.lang.money_decimal,
			thousand: PC_config.lang.money_thousand,
			format: PC_config.lang.money_format
		} );
	},
	maybeConvertAmountToCurrency: function( amount ) {
		// WOOCS
		if ( 'undefined' != typeof woocs_current_currency && 'undefined' != woocs_current_currency['rate'] ) {
			return amount * woocs_current_currency['rate'];
		}
		
		// WCML
		if ( 'undefined' != typeof PC.fe.config.wcml_rate && parseFloat( PC.fe.config.wcml_rate ) ) {
			return amount * parseFloat( PC.fe.config.wcml_rate );
		}
		
		// Aelia CS
		if ( 'undefined' != typeof wc_aelia_currency_switcher_params && 'undefined' != wc_aelia_currency_switcher_params.current_exchange_rate_from_base && 0 < parseFloat( wc_aelia_currency_switcher_params.current_exchange_rate_from_base ) ) {
			return amount * parseFloat( wc_aelia_currency_switcher_params.current_exchange_rate_from_base );
		}

		// Price Based on Country
		if ( 'undefined' != typeof PC.fe.config.wcpbc_rate && parseFloat( PC.fe.config.wcpbc_rate ) ) {
			var converted = amount * parseFloat( PC.fe.config.wcpbc_rate );
			if ( PC.fe.config.wcpbc_round_nearest ) {
				converted = Math.ceil( converted / PC.fe.config.wcpbc_round_nearest ) * PC.fe.config.wcpbc_round_nearest;
			}
			return converted;
		}


		return amount;
	},
	/**
	 * Add the language filters
	 *
	 * @param {string} lang 
	 */
	 add_language_filters: function( lang ) {
		var maybe_change_name_and_description = function( attributes ) {
			if ( attributes['name_' + lang] && '' != attributes['name_' + lang].trim() ) attributes.name = attributes['name_' + lang];
			if ( attributes['description_' + lang] && '' != attributes['description_' + lang].trim() ) attributes.description = attributes['description_' + lang];
			return attributes;
		}

		wp.hooks.addFilter( 'PC.fe.configurator.layer_data', 'mkl/product_configurator', maybe_change_name_and_description, 10 );
		wp.hooks.addFilter( 'PC.fe.configurator.choice_data', 'mkl/product_configurator', maybe_change_name_and_description, 10 );
		wp.hooks.addFilter( 'PC.fe.configurator.angle_data', 'mkl/product_configurator', maybe_change_name_and_description, 10 );
	},
	strip_html: function( html ) {
		let doc = new DOMParser().parseFromString(html, 'text/html');
		return doc.body.textContent || "";
	},

	escape_html: function(str) {
		return String(str).replace(/[&<>"']/g, s => (
		  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s]
		));
	},
	get_message_with_vars: function(template, vars) {
		return template.replace(/{{(.*?)}}/g, (_, key) => PC.utils.escape_html(vars[key.trim()] ?? ''));
	}

};