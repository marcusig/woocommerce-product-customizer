PC.fe.errors = [];

PC.fe.save_data = {
	choices: [],
	save: function() {
		this.reset_errors();
		this.choices = [];
		PC.fe.layers.each( this.parse_choices, this ); 
		this.choices = wp.hooks.applyFilters( 'PC.fe.save_data.choices', this.choices );
		return JSON.stringify( this.choices );
	},
	get_choices: function() {
		this.save();
		return this.choices;
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
		PC.fe.errors = [];
	},
	is_layer_valid: function( layer ) {
		this.reset_errors();
		this.validate_layer( layer );
		return ! PC.fe.errors.length;
	},
	validate_layer: function( layer ) {
		if ( 'group' == layer.get( 'type' ) ) {
			var children = layer.collection.where( { parent: layer.id } );
			_.each( children, this.validate_layer.bind( this ) );
			return;
		}
		this.parse_choices( layer );
	},
	count_selected_choices_in_group: function( group_id ) {
		var children = PC.fe.layers.filter( function( layer ) {
			return group_id == layer.get( 'parent' ) && false !== layer.get( 'cshow' );
		} );
		var selected = 0;
		_.each( children, function( child_layer ) {
			var type = child_layer.get( 'type' )
			if ( 'group' === type ) {
				selected += this.count_selected_choices_in_group( child_layer.id );
				return;
			}
			
			var choices = PC.fe.getLayerContent( child_layer.id );
			if ( ! choices ) return;

			if ( 'simple' === type || 'multiple' === type ) {
				var selection = choices.filter( function( choice ) {
					return choice.get( 'active' ) && false !== choice.get( 'cshow' );
				} );
				selected += selection.length;
			}
			if ( 'form' === type ) {
				var selection = PC.fe.getLayerContent( child_layer.id ).filter( function( choice ) {
					return false !== choice.get( 'cshow' ) && ! choice.get( 'is_group' );
				} );
				selected += selection.length;
			}
		}.bind( this ) );
		return selected;
	},
	// get choices for one layer 
	parse_choices: function( model ) {
		var is_required = parseInt( model.get( 'required' ) );
		var default_selection = model.get( 'default_selection' ) || 'select_first';
		var type = model.get( 'type' );

		// If the layer is hidden, ignore it
		if ( false === model.get( 'cshow' ) ) return;

		if ( 'form' == type || 'group' == type ) is_required = false;

		if ( PC.fe.config.angles.save_current ) {
			var angle = PC.fe.angles.findWhere( 'active', true );
		} else {
			var angle = PC.fe.angles.findWhere( 'use_in_cart', true );
		}
		if ( ! angle ) {
			angle = PC.fe.angles.first();
		}

		var model_data = wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', model.attributes );
		var angle_id = wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.angle_id', angle.id );

		if ( 'group' == type ) {
			if ( ! this.count_selected_choices_in_group( model.id ) ) return;
			if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_layer_group', true, model ) ) this.choices.push( 
				wp.hooks.applyFilters(
					'PC.fe.save_data.parse_choices.added_group_layer',
					{
						is_choice: false,
						layer_id: model.id,
						choice_id: 0,
						angle_id: angle_id,
						layer_name: model_data.name,
						image: 0,
						name: '',
					},
					model
				)
			);
			return;
		}
		var require_error = false;
		var choices = PC.fe.getLayerContent( model.id );
		if ( ! choices ) return;
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
				if ( ! is_required && ! selected_choices.length && 'simple' == type && 'select_first' == default_selection && ! model.get( 'can_deselect' ) ) {
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
							message: PC_config.lang.out_of_stock_error_message.replace( '%s', model_data.name + ' > ' + choice.get_name() )
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
								layer_name: model_data.name,
								image: img_id,
								name: choice.get_name(),
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
							message: PC_config.lang.out_of_stock_error_message.replace( '%s', model_data.name + ' > ' + choice.get_name() )
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
						name: choice.get_name(),
					}
				)
			);
		}

		if ( require_error ) {	
			PC.fe.errors.push( {
				choice: false,
				layer: model,
				message: PC_config.lang.required_error_message.replace( '%s', model_data.name ) 
			} );
		}

		wp.hooks.doAction( 'PC.fe.save_data.parse_choices.after', model, this );
	}

};
