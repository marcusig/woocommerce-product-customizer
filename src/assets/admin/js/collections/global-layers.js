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
		},

		/**
		 * Set edit state for choices of a global layer (not persisted)
		 */
		set_editing_choices: function( global_id, is_editing ) {
			var model = this.get_or_create( global_id );
			model.set( 'is_editing_choices', !! is_editing );
			if ( ! this.edit_states[global_id] ) this.edit_states[global_id] = {};
			this.edit_states[global_id].is_editing_choices = !! is_editing;
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
		 */
		fetch_global_layer: function( global_id, options ) {
			options = options || {};
			var model = this.get_or_create( global_id );
			
			return wp.ajax.post( {
				action: 'mkl_pc_get_global_layer',
				global_id: global_id,
				nonce: ( window.PC_lang && PC_lang.global_layers_nonce ) ? PC_lang.global_layers_nonce : undefined
			} ).done( function( response ) {
				if ( response && response.layer ) {
					model.set( {
						layer: response.layer,
						content: response.content || null
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
		 * @param {Object} content_data - Content/choices data (optional if only updating layer)
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
				options.success( model, response );
			}.bind( this ) ).fail( function( error ) {
				if ( options.error ) options.error( model, error );
			}.bind( this ) );
		},

		/**
		 * Fetch choices for a specific global layer
		 * @param {number} global_id - The CPT post ID
		 * @param {number} layer_id - The local layer ID
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
					// Update local model's content with fetched choices
					var current_content = model.get( 'content' ) || [];
					// Find and update the content entry for this layer
					var found = false;
					for ( var i = 0; i < current_content.length; i++ ) {
						if ( current_content[i].layerId == layer_id ) {
							current_content[i].choices = response.content;
							found = true;
							break;
						}
					}
					if ( ! found ) {
						current_content.push( {
							layerId: layer_id,
							choices: response.content,
							global_id: global_id
						} );
					}
					model.set( 'content', current_content );
					if ( options.success ) options.success( response.content, response );
				} else if ( options.error ) {
					options.error( model, response );
				}
			}.bind( this ) ).fail( function( error ) {
				if ( options.error ) options.error( model, error );
			}.bind( this ) );
		},
	});

} ) ( PC._us || window._ );

