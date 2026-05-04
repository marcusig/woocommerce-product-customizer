var PC = PC || {};

( function( _ ) {
	/**
	 * Global Layers Collection
	 * 
	 * Stores global layer data and edit states across the configurator.
	 * Edit states are not persisted to DB.
	 */
	PC.global_layers = Backbone.Collection.extend({
		url: function() {
			return ajaxurl + '?action=mkl_pc_global_layers';
		},
		model: Backbone.Model.extend({
			defaults: {
				global_id: null,
				layer: null,
				content: null,
				is_editing_layer: false,
				is_editing_choices: false,
			}
		}),
		
		initialize: function( models, options ) {
			// Edit states (not persisted)
			this.edit_states = {};
		},

		/**
		 * Process choices array and update layerId to the target layer ID
		 * Global layers store only an array of choices (no layerId wrapper)
		 * @param {Array} choices - Array of choice objects
		 * @param {number} target_layer_id - The target layer ID to use
		 * @return {Array} Processed choices array with updated layerIds
		 */
		process_content_layer_id: function( choices, target_layer_id ) {
			if ( ! choices || ! target_layer_id ) return choices;

			// CPT may store { choices: [...] } or a bare choice list; normalize to an array of choices.
			if ( choices && typeof choices === 'object' && ! Array.isArray( choices ) && Array.isArray( choices.choices ) ) {
				choices = choices.choices;
			}

			// Global layers should always be an array of choices
			if ( Array.isArray( choices ) ) {
				return _.map( choices, function( choice ) {
					var processed_choice = _.extend( {}, choice );
					processed_choice.layerId = target_layer_id;
					return processed_choice;
				} );
			}
			
			return choices;
		},

		/**
		 * Get or create a global layer entry
		 * @param {number} global_id - The CPT post ID
		 * @return {Backbone.Model}
		 */
		get_or_create: function( global_id ) {
			var model = this.get( global_id );
			if ( ! model ) {
				model = this.add({
					id: global_id,
					global_id: global_id,
					layer: null,
					content: null,
					is_editing_layer: false,
					is_editing_choices: false
				});
			}
			return model;
		},

		/**
		 * Set edit state for a global layer (not persisted)
		 */
		set_editing_layer: function( global_id, is_editing ) {
			var model = this.get_or_create( global_id );
			model.set( 'is_editing_layer', !! is_editing );
			this.edit_states[global_id] = { is_editing_layer: !! is_editing };
			if ( PC.app && PC.app.syncGlobalLayerFocusChrome ) {
				PC.app.syncGlobalLayerFocusChrome();
			}
			if ( PC.app && PC.app.syncSidebarSaveButtonState ) {
				PC.app.syncSidebarSaveButtonState();
			}
		},

		/**
		 * Set edit state for choices of a global layer (not persisted)
		 */
		set_editing_choices: function( global_id, is_editing ) {
			var model = this.get_or_create( global_id );
			model.set( 'is_editing_choices', !! is_editing );
			if ( ! this.edit_states[global_id] ) this.edit_states[global_id] = {};
			this.edit_states[global_id].is_editing_choices = !! is_editing;
			if ( PC.app && PC.app.syncGlobalLayerFocusChrome ) {
				PC.app.syncGlobalLayerFocusChrome();
			}
			if ( PC.app && PC.app.syncSidebarSaveButtonState ) {
				PC.app.syncSidebarSaveButtonState();
			}
		},

		/**
		 * Get edit state for layer
		 */
		is_editing_layer: function( global_id ) {
			var model = this.get( global_id );
			return model ? model.get( 'is_editing_layer' ) : false;
		},

		/**
		 * Get edit state for choices
		 */
		is_editing_choices: function( global_id ) {
			var model = this.get( global_id );
			return model ? model.get( 'is_editing_choices' ) : false;
		},

		/**
		 * Fetch a global layer from server
		 * @param {number} global_id - The CPT post ID
		 * @param {Object} options - jQuery AJAX options
		 *   - target_layer_id (optional) - If provided, updates choice layerIds to this ID
		 *   - success - Success callback
		 *   - error - Error callback
		 */
		fetch_global_layer: function( global_id, options ) {
			options = options || {};
			var model = this.get_or_create( global_id );
			var target_layer_id = options.target_layer_id || null;
			
			return wp.ajax.post( {
				action: 'mkl_pc_get_global_layer',
				global_id: global_id,
				nonce: ( window.PC_lang && PC_lang.global_layers_nonce ) ? PC_lang.global_layers_nonce : undefined
			} ).done( function( response ) {
				if ( response && response.layer ) {
					var processed_content = response.content;
					
					// Process choices to update layerIds if target_layer_id is provided
					if ( target_layer_id && processed_content ) {
						processed_content = this.process_content_layer_id( processed_content, target_layer_id );
						// Also update the response object for the callback
						response.content = processed_content;
					}
					
					model.set( {
						layer: response.layer,
						content: processed_content || null
					} );
					if ( options.success ) options.success( model, response );
				}
			}.bind( this ) ).fail( function( error ) {
				if ( options.error ) options.error( model, error );
			}.bind( this ) );
		},

		/**
		 * Save a global layer to server
		 * @param {number} global_id - The CPT post ID (0 for new)
		 * @param {Object} layer_data - Layer data (optional if only updating content)
		 * @param {Array} content_data - Array of choice objects (optional if only updating layer)
		 * @param {Object} options - jQuery AJAX options
		 */
		save_global_layer: function( global_id, layer_data, content_data, options ) {
			options = options || {};
			var model = this.get_or_create( global_id );
			
			return wp.ajax.post( {
				action: 'mkl_pc_save_global_layer',
				global_id: global_id,
				layer: layer_data ? JSON.stringify( layer_data ) : null,
				content: content_data ? JSON.stringify( content_data ) : null,
				nonce: ( window.PC_lang && PC_lang.global_layers_nonce ) ? PC_lang.global_layers_nonce : undefined
			} ).done( function( response ) {
				// Update local model with saved data
				if ( layer_data ) {
					model.set( 'layer', layer_data );
				}
				if ( content_data ) {
					model.set( 'content', content_data );
				}
				if ( options.success ) {
					options.success( model, response );
				}
			}.bind( this ) ).fail( function( error ) {
				if ( options.error ) options.error( model, error );
			}.bind( this ) );
		},

		/**
		 * Fetch choices for a specific global layer
		 * @param {number} global_id - The CPT post ID
		 * @param {number} layer_id - The local layer ID (will be used to update layerIds in choices)
		 * @param {Object} options - jQuery AJAX options
		 */
		fetch_global_choices: function( global_id, layer_id, options ) {
			options = options || {};
			var model = this.get_or_create( global_id );
			var product = PC.app && PC.app.get_product ? PC.app.get_product() : null;
			
			return wp.ajax.post( {
				action: 'mkl_pc_get_global_layer',
				product_id: product && product.id ? product.id : 0,
				layer_id: layer_id,
				is_global: 1,
				global_id: global_id,
				nonce: ( window.PC_lang && PC_lang.global_layers_nonce ) ? PC_lang.global_layers_nonce : undefined
			} ).done( function( response ) {
				if ( response.content ) {
					// Process choices to update layerIds (global layers store array of choices)
					var choices_array = this.process_content_layer_id( response.content, layer_id );
					
					// Update local model's content with fetched choices
					var current_content = model.get( 'content' ) || [];
					// Find and update the content entry for this layer
					var found = false;
					for ( var i = 0; i < current_content.length; i++ ) {
						if ( current_content[i].layerId == layer_id ) {
							current_content[i].choices = choices_array;
							current_content[i].layerId = layer_id;
							found = true;
							break;
						}
					}
					if ( ! found ) {
						current_content.push( {
							layerId: layer_id,
							choices: choices_array,
							global_id: global_id
						} );
					}
					model.set( 'content', current_content );
					
					// Return processed choices array in response
					if ( options.success ) options.success( choices_array, response );
				} else if ( options.error ) {
					options.error( model, response );
				}
			}.bind( this ) ).fail( function( error ) {
				if ( options.error ) options.error( model, error );
			}.bind( this ) );
		},
	});

} ) ( PC._us || window._ );

