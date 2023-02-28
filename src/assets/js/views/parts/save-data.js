PC.fe.errors = [];

PC.fe.save_data = {
	choices: [],
	save: function() {
		PC.fe.errors = [];
		this.choices = [];
		PC.fe.layers.each( this.parse_choices, this ); 
		this.choices = wp.hooks.applyFilters( 'PC.fe.save_data.choices', this.choices );
		return JSON.stringify( this.choices );
	},

	reset_errors: function() {
		if ( PC.fe.errors.length ) {
			_.each( PC.fe.errors, function( error ) {
				if ( error.choice && error.choice.get( 'has_error' ) ) {
					error.choice.set( 'has_error', false );
				}
				if ( error.layer && error.layer.get( 'has_error' ) ) {
					error.layer.set( 'has_error', false );
				}
			} );
		}
	},
	is_layer_valid: function( layer ) {
		this.reset_errors();
		PC.fe.errors = [];
		this.parse_choices( layer );
		return ! PC.fe.errors.length;
	},
	// get choices for one layer 
	parse_choices: function( model ) {
		var is_required = parseInt( model.get( 'required' ) );
		var default_selection = model.get( 'default_selection' ) || 'select_first';
		var type = model.get( 'type' );
		if ( 'form' == type || 'group' == type ) is_required = false;
		if ( PC.fe.config.angles.save_current ) {
			var angle = PC.fe.angles.findWhere( 'active', true );
		} else {
			var angle = PC.fe.angles.findWhere( 'use_in_cart', true );
		}
		if ( ! angle ) {
			angle = PC.fe.angles.first();
		}

		var angle_id = wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.angle_id', angle.id );

		if ( 'group' == type ) {
			if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_layer_group', true, model ) ) this.choices.push( 
				wp.hooks.applyFilters(
					'PC.fe.save_data.parse_choices.added_group_layer',
					{
						is_choice: false,
						layer_id: model.id,
						choice_id: 0,
						angle_id: angle_id,
						layer_name: model.get( 'name' ),
						image: 0,
						name: '',
					},
					model
				)
			);
		}
		var require_error = false;
		var choices = PC.fe.getLayerContent( model.id );
		if ( ! choices ) return;
		// Check if the layer is hidden:
		if ( false === model.get( 'cshow' ) ) return;
		if ( PC.hasOwnProperty( 'conditionalLogic' ) && PC.conditionalLogic.parent_is_hidden && PC.conditionalLogic.parent_is_hidden( model ) ) return;
		var first_choice = choices.first().id;
		if ( ! model.attributes.not_a_choice ) {
			// Simple with at least 2 items, and multiple choices
			if ( choices.length > 1 || 'multiple' == type ) {

				var selected_choices = choices.where( { 'active': true } );

				if ( is_required && ! selected_choices.length ) {
					require_error = true;
				}

				// Simple layer without a selection (e.g. all items are out of stock)
				if ( ! is_required && ! selected_choices.length && 'simple' == type && 'select_first' == default_selection ) {
					require_error = true;
				}

				_.each( selected_choices, function( choice ) {
					if ( false === choice.get( 'cshow' ) ) return;
					if ( PC.hasOwnProperty( 'conditionalLogic' ) && PC.conditionalLogic.parent_is_hidden && PC.conditionalLogic.parent_is_hidden( choice ) ) return;
					// Check for a required item
					if ( 
						'select_first' == default_selection
						&& is_required 
						&& 'simple' == type
						&& first_choice == choice.id
					) {
						require_error = true;
					}

					// The item is out of stock, so throw an error
					if ( false === choice.get( 'available' ) ) {
						PC.fe.errors.push( {
							choice: choice,
							message: PC_config.lang.out_of_stock_error_message.replace( '%s', model.get( 'name' ) + ' > ' + choice.get( 'name' ) )
						} );
					}

					var img_id = choice.get_image( 'image', 'id' );
					if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_choice', true, choice ) ) this.choices.push( 
						wp.hooks.applyFilters(
							'PC.fe.save_data.parse_choices.added_choice',
							{
								is_choice: true,
								layer_id: model.id,
								choice_id: choice.id,
								angle_id: angle_id,
								layer_name: model.attributes.name,
								image: img_id,
								name: choice.attributes.name,
							},
							choice
						)
					);
				}, this );

			} else {
				// Only one choice
				var choice = choices.first();
				var is_active = choice.get( 'active' );
				if ( is_active || ( 'simple' != model.get( 'type' ) && 'multiple' != model.get( 'type' ) && 'form' != model.get( 'type' ) ) ) {
					if ( false === choice.get( 'cshow' ) ) return;
					var img_id = choice.get_image('image', 'id'); 
					if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_choice', true, choice ) ) this.choices.push(
						wp.hooks.applyFilters(
							'PC.fe.save_data.parse_choices.added_choice',
							{
								is_choice: false,
								layer_id: model.id, 
								choice_id: choice.id, 
								angle_id: angle_id,
								image: img_id,
							},
							choice
						)
					);

					// The item is out of stock, so throw an error
					if ( false === choice.get( 'available' ) ) {
						PC.fe.errors.push( {
							choice: choice,
							message: PC_config.lang.out_of_stock_error_message.replace( '%s', model.get( 'name' ) + ' > ' + choice.get( 'name' ) ) 
						} );
					}
				} else if ( is_required ) {
					require_error = true;
				}
			}
		} else {
			// Not a choice
			var choice = choices.first();
			var img_id = choice.get_image('image', 'id');
			if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_choice', true, choice ) ) this.choices.push(
				wp.hooks.applyFilters(
					'PC.fe.save_data.parse_choices.added_choice',
					{
						is_choice: false,
						layer_id: model.id,
						choice_id: choice.id,
						angle_id: angle_id,
						image: img_id,
						name: choice.attributes.name,
					}
				)
			);
		}

		if ( require_error ) {	
			PC.fe.errors.push( {
				choice: false,
				layer: model,
				message: PC_config.lang.required_error_message.replace( '%s', model.get( 'name' ) ) 
			} );
		}

		wp.hooks.doAction( 'PC.fe.save_data.parse_choices.after', model, this );
	}

};
