( function( $ ) {
	var modalId;
	var button_label;
	wp.hooks.addAction( 'PC.fe.start', 'MKL/PC/Elementor', function( configurator ) {
		// Get the modal ID 
		var modal_container = $( '.js-mkl-pc-elementor-configuration-modal--container' );
		if ( ! modal_container.length ) return;
		modalId = parseInt( modal_container.data( 'modal-id' ) );
		button_label = modal_container.data( 'button-label' );

		if ( ! modalId ) return;
		// Add button view, with the modal ID to open
		configurator.$( '.pc_configurator_form' ).append( new button_view().$el );
		// open modal using this:
		// elementorProFrontend.modules.popup.showPopup({id: 26805})

	} );

	$( document ).on( 'elementor/popup/show', ( event, popupId, popupDoc ) => {
		if ( modalId != popupId ) return;
		// Render a summary view and copy the insert content in the summary placehoder
		var summary = new PC.fe.views.summary()
		var config = summary.$el.html();

		var the_choices = PC.fe.save_data.get_choices();
		var items = [];
		var images = [];
		_.each( the_choices, function( item ) {
			if ( ! item.is_choice ) return;
			var layer = PC.fe.layers.get( item.layer_id );
			if ( ! layer ) return;
			if ( item.image ) {
				images.push({
					id: item.image,
					order: layer.get( 'image_order' ) || layer.get( 'order' )
				} );
			}
			var choice = PC.fe.get_choice_model( item.layer_id, item.choice_id );
			if ( choice && 'calculation' == choice.get( 'text_field_type' ) ) return;
			if ( layer.get( 'hide_in_summary' ) || layer.get( 'hide_in_configurator' ) ) return;
			if ( layer.get( 'hide_in_summary' ) || layer.get( 'hide_in_configurator' ) ) return;
			if ( item.hasOwnProperty( 'field_value' ) ) {
				var value = item.field_label || item.field_value;
				items.push( item.name + ' : ' + value );
			} else {
				items.push( item.layer_name + ' : ' + item.name )
			}
		} );

		popupDoc.$element.find( '.elementor-field-type-configuration input.elementor-field-configuration-summary' ).val( items.join( ', ' ) );
		popupDoc.$element.find( '#form-field-mkl_configuration' ).val( items.join( ', ' ) );
		popupDoc.$element.find( '#form-field-mkl_configuration_price' ).val( PC.fe.modal.$( '.pc-total-price' ).text() );
		if ( popupDoc.$element.find( '#form-field-mkl_configuration_image' ).length && images.length ) {
			var image_list = _.sortBy( images, 'order' ).map( item => item.id ).join( '-' );
			var t = PC_config.image_endpoint + `${PC.fe.active_product}/${image_list}/?width=500&height=500`;
			popupDoc.$element.find( '#form-field-mkl_configuration_image' ).val( t );
		}

		// Set field data with Raw configuration
		popupDoc.$element.find( '.elementor-field-type-configuration input[name="configurator_data_raw"]' ).val( JSON.stringify( the_choices ) );
		popupDoc.$element.find( '.elementor-field-type-configuration input[name="configured_product_id"]' ).val( PC.fe.active_product );
		popupDoc.$element.find( '.elementor-field-type-configuration .elementor-configuration-field-summary' ).html( config );

		// Add price to field
		if ( popupDoc.$element.find( '.configurator-price' ).length ) {
			popupDoc.$element.find( '.configurator-price' ).val( PC.fe.modal.$( '.pc-total-price' ).text() );
		}
	} );

	var button_view = Backbone.View.extend( {
		tagName: 'button',
		className: 'button btn btn-secondary e-open-modal',
		events: {
			'click': 'on_click',
		},
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.html( button_label );
		},
		on_click: function( e ) {
			elementorProFrontend.modules.popup.showPopup( { id: modalId } )
		}
	} );

	window.mkl_pc_elementor = window.mkl_pc_elementor || {};
	window.mkl_pc_elementor.open_modal_button = button_view;
} )( jQuery );
