var PC = PC || {};
// Backbone.emulateHTTP = true;

PC.toJSON = function( item ) {
	var _ = PC._us || window._;
	if ( item instanceof Backbone.Collection ) {
		var models = []; 
		item.each( function( model ) {
			models.push( PC.toJSON( model ) );
		} );
		return models;
	}

	if ( item instanceof Backbone.Model ) {
		var json = _.clone( item.attributes ); 
	} else {
		var json = _.clone( item );
	}
	for ( var attr in json ) {
		if ( json[attr] instanceof Backbone.Model || json[attr] instanceof Backbone.Collection || json[attr] instanceof Object ) {
			json[attr] = PC.toJSON( json[attr] );
		}
	}
	return json;
};

! ( function( $, _ ) {
	PC.actionParameter = 'pc_get_data'; 
	PC.setActionParameter = 'pc_set_data'; 
	// PC.base_url = 
	PC.app = PC.app || {
		is_modified: {
			layers: false,
			angles: false,
			content: false,
		},
		modified_choices: [],
		modified_layer_ids: {},
		deleted_layer_ids: [],
		modified_content_layer_ids: {},
		state: null,
		init: function( options ) {
			PC.lang = PC_lang || {};
			if ( options.product_id === undefined) { 
				throw( { name: 'Error', message: 'product_id parameter is missing to start the configurator.' } );
				return false; 
			}

			var id = this.id = ( options.product_type == 'simple' ) ? options.product_id : options.parent_id;

			if ( ! this.admin ) {

				this.admin_data = new PC.admin({
					id: id
				});
				this.admin = new PC.views.admin({ model: this.admin_data });
			}

			// document.addEventListener( 'paste', ( e ) => {
			// 	if ( !app.configuratorView?.isVisible() ) return;

			// 	const text = e.clipboardData.getData( 'text/plain' );
			// 	if ( !text.startsWith( 'PCCOPY-' ) ) return;
				
			// } );
			
			// $( window ).on( 'focus', function( e ) {
				
			// 	navigator.clipboard.readText().then( content => {
			// 		if ( ! content.startsWith( 'PCCOPY-' ) ) return;
			// 		var data = content.substring( 7 );
			// 		$( document.body ).trigger( 'clipboard-has-configuration', data );
			// 	} );
			// } );

			// $( document.body ).on( 'clipboard-has-configuration', function( e, data ) {
			// 	PC.clipboard_data = data;
			// } );

			return this.admin;
		},
		start: function( options ) {

			this.options = options || {};
			
			if ( !this.admin ) this.init( options );
			this.admin.open( options );
		},
		get_admin: function() {
			return this.admin;
		},
		get_product: function() {
			return this.admin.get_current_product();
		},
		// used to save a collection to the 
		get_collection: function( key ) {

			switch ( key ) {
				case 'content':
				case 'conditions':
					return this.get_product().get( key );
				case 'layers':
				case 'angles':
				default :
					return this.admin[ key ];
			}
		},
		get_layer_content: function( layerId ) {
			var content = PC.app.get_collection( 'content' );
			if ( ! content ) return false;
			var layer_content = content.get( layerId );
			if ( ! layer_content ) return false;
			return layer_content.get( 'choices' );
		},
		get_choice_model: function( layerId, choiceId ) {
			var content = this.get_layer_content( layerId );
			return content.get( choiceId ) || false;
		},
		/**
		 * Max layer rows per layers delta save request (default 50).
		 *
		 * @return {number}
		 */
		get_layer_save_batch_max: function() {
			var default_max_layers = 5;
			if ( window.wp && wp.hooks && wp.hooks.applyFilters ) {
				var filtered_max = parseInt( wp.hooks.applyFilters( 'mkl_pc_admin_layer_save_batch_max', default_max_layers ), 10 );
				return filtered_max > 0 ? filtered_max : default_max_layers;
			}
			return default_max_layers;
		},
		/**
		 * Max total choices per content delta batch (greedy packing).
		 *
		 * @return {number}
		 */
		get_content_save_max_choices_per_batch: function() {
			var default_max_choices = 60;
			if ( window.wp && wp.hooks && wp.hooks.applyFilters ) {
				var filtered_max = parseInt( wp.hooks.applyFilters( 'mkl_pc_admin_content_save_max_choices_per_batch', default_max_choices ), 10 );
				return filtered_max > 0 ? filtered_max : default_max_choices;
			}
			return default_max_choices;
		},
		/**
		 * Max approx. JSON bytes per content delta batch.
		 *
		 * @return {number}
		 */
		get_content_save_max_bytes_per_batch: function() {
			var default_max_bytes = 512 * 1024;
			if ( window.wp && wp.hooks && wp.hooks.applyFilters ) {
				var filtered_max = parseInt( wp.hooks.applyFilters( 'mkl_pc_admin_content_save_max_bytes_per_batch', default_max_bytes ), 10 );
				return filtered_max > 0 ? filtered_max : default_max_bytes;
			}
			return default_max_bytes;
		},
		count_choices_in_content_item: function( content_layer_json ) {
			if ( ! content_layer_json || ! content_layer_json.choices ) {
				return 0;
			}
			if ( Array.isArray( content_layer_json.choices ) ) {
				return content_layer_json.choices.length;
			}
			return 0;
		},
		/**
		 * Layer IDs with local edits, in canonical order (structure index first, then extras).
		 *
		 * @param {Array} layers_index
		 * @param {Object} modified_layer_map
		 * @return {string[]}
		 */
		order_modified_layer_ids_for_save: function( layers_index, modified_layer_map ) {
			var layer_modifications = modified_layer_map || {};
			var modified_layer_keys = Object.keys( layer_modifications );
			var ordered_layer_ids = [];
			var seen_layer_ids = {};
			var structure_index;
			var layer_identifier_string;
			var extra_key_index;
			for ( structure_index = 0; structure_index < layers_index.length; structure_index++ ) {
				layer_identifier_string = String( layers_index[ structure_index ] );
				if ( modified_layer_keys.indexOf( layer_identifier_string ) !== -1 && ! seen_layer_ids[ layer_identifier_string ] ) {
					ordered_layer_ids.push( layer_identifier_string );
					seen_layer_ids[ layer_identifier_string ] = true;
				}
			}
			for ( extra_key_index = 0; extra_key_index < modified_layer_keys.length; extra_key_index++ ) {
				layer_identifier_string = modified_layer_keys[ extra_key_index ];
				if ( ! seen_layer_ids[ layer_identifier_string ] ) {
					ordered_layer_ids.push( layer_identifier_string );
					seen_layer_ids[ layer_identifier_string ] = true;
				}
			}
			return ordered_layer_ids;
		},
		/**
		 * Content layer IDs with local edits, in collection order.
		 *
		 * @param {Backbone.Collection} layers_collection
		 * @param {Object} modified_content_map
		 * @return {string[]}
		 */
		order_modified_content_layer_ids_for_save: function( layers_collection, modified_content_map ) {
			var content_modifications = modified_content_map || {};
			var modified_content_keys = Object.keys( content_modifications );
			var ordered_content_layer_ids = [];
			var seen_content_layer_ids = {};
			layers_collection.each( function( layer_model ) {
				var layer_identifier_string = String( layer_model.id );
				if ( modified_content_keys.indexOf( layer_identifier_string ) !== -1 && ! seen_content_layer_ids[ layer_identifier_string ] ) {
					ordered_content_layer_ids.push( layer_identifier_string );
					seen_content_layer_ids[ layer_identifier_string ] = true;
				}
			} );
			var extra_key_index;
			var layer_identifier_string;
			for ( extra_key_index = 0; extra_key_index < modified_content_keys.length; extra_key_index++ ) {
				layer_identifier_string = modified_content_keys[ extra_key_index ];
				if ( ! seen_content_layer_ids[ layer_identifier_string ] ) {
					ordered_content_layer_ids.push( layer_identifier_string );
					seen_content_layer_ids[ layer_identifier_string ] = true;
				}
			}
			return ordered_content_layer_ids;
		},
		/**
		 * Split layers delta into batches; deletions run only on the last batch.
		 *
		 * @param {Backbone.Collection} layers_collection
		 * @param {Array} layers_index
		 * @param {string[]} ordered_modified_layer_ids
		 * @param {Array} deleted_layer_ids
		 * @return {Array<Object>}
		 */
		build_layers_delta_batches: function( layers_collection, layers_index, ordered_modified_layer_ids, deleted_layer_ids ) {
			var max_layers_per_batch = this.get_layer_save_batch_max();
			var deleted_ids_copy = deleted_layer_ids && deleted_layer_ids.length ? deleted_layer_ids.slice() : [];
			var layer_save_batches = [];
			var chunk_offset;
			var chunk_index;
			var layer_id_chunk;
			var layers_payload_by_id;
			var is_final_batch;
			if ( ordered_modified_layer_ids.length === 0 ) {
				if ( deleted_ids_copy.length ) {
					layer_save_batches.push( { layers_index: layers_index, layers: {}, deleted: deleted_ids_copy } );
				}
				return layer_save_batches;
			}
			for ( chunk_offset = 0; chunk_offset < ordered_modified_layer_ids.length; chunk_offset += max_layers_per_batch ) {
				layer_id_chunk = ordered_modified_layer_ids.slice( chunk_offset, chunk_offset + max_layers_per_batch );
				is_final_batch = ( chunk_offset + max_layers_per_batch ) >= ordered_modified_layer_ids.length;
				layers_payload_by_id = {};
				for ( chunk_index = 0; chunk_index < layer_id_chunk.length; chunk_index++ ) {
					var layer_identifier = layer_id_chunk[ chunk_index ];
					var layer_model = layers_collection.get( layer_identifier );
					if ( layer_model ) {
						layers_payload_by_id[ layer_identifier ] = layer_model.toJSON();
					}
				}
				layer_save_batches.push( {
					layers_index: layers_index,
					layers: layers_payload_by_id,
					deleted: is_final_batch ? deleted_ids_copy : [],
				} );
			}
			return layer_save_batches;
		},
		/**
		 * Greedy content batches by choice count and JSON size.
		 *
		 * @param {Backbone.Collection} content_collection
		 * @param {string[]} ordered_content_layer_ids
		 * @return {Array<Object>}
		 */
		build_content_delta_batches: function( content_collection, ordered_content_layer_ids ) {
			var max_choices_per_batch = this.get_content_save_max_choices_per_batch();
			var max_bytes_per_batch = this.get_content_save_max_bytes_per_batch();
			var content_save_batches = [];
			var current_batch_content = {};
			var batch_choice_total = 0;
			var batch_byte_total = 0;
			var app_context = this;
			var flush_current_batch = function() {
				if ( Object.keys( current_batch_content ).length ) {
					content_save_batches.push( { content: _.extend( {}, current_batch_content ) } );
					current_batch_content = {};
					batch_choice_total = 0;
					batch_byte_total = 0;
				}
			};
			ordered_content_layer_ids.forEach( function( layer_identifier ) {
				var layer_model = content_collection.get( layer_identifier );
				if ( ! layer_model ) {
					return;
				}
				var content_layer_json = layer_model.toJSON();
				var choice_count = app_context.count_choices_in_content_item( content_layer_json );
				var json_byte_length = JSON.stringify( content_layer_json ).length;
				if ( choice_count > max_choices_per_batch || json_byte_length > max_bytes_per_batch ) {
					flush_current_batch();
					var single_layer_content = {};
					single_layer_content[ String( layer_identifier ) ] = content_layer_json;
					content_save_batches.push( { content: single_layer_content } );
					return;
				}
				if ( Object.keys( current_batch_content ).length && ( batch_choice_total + choice_count > max_choices_per_batch || batch_byte_total + json_byte_length > max_bytes_per_batch ) ) {
					flush_current_batch();
				}
				current_batch_content[ String( layer_identifier ) ] = content_layer_json;
				batch_choice_total += choice_count;
				batch_byte_total += json_byte_length;
			} );
			flush_current_batch();
			return content_save_batches;
		},
		/**
		 * Sequential pc_set_data requests for multiple payloads of the same component.
		 *
		 * @param {string} collection_key
		 * @param {Array<Object>} request_batches
		 * @param {Object} ajax_options
		 * @return {jQuery.Promise}
		 */
		send_configurator_save_batches: function( collection_key, request_batches, ajax_options ) {
			var success_callback = ajax_options.success;
			var error_callback = ajax_options.error;
			var request_context = ajax_options.context || this;
			var shared_request_data = _.extend( {}, ajax_options.data );
			var request_chain = $.when();
			var last_success_response;
			request_batches.forEach( function( batch_payload ) {
				request_chain = request_chain.then( function() {
					var batch_ajax_options = _.extend( {}, ajax_options, {
						data: _.extend( {}, shared_request_data ),
					} );
					batch_ajax_options.data[ collection_key ] = JSON.stringify( batch_payload );
					delete batch_ajax_options.success;
					delete batch_ajax_options.error;
					return wp.ajax.send( batch_ajax_options ).done( function( response_body ) {
						last_success_response = response_body;
					} );
				} );
			} );
			request_chain.done( function() {
				if ( success_callback ) {
					success_callback.call( request_context, last_success_response );
				}
			} );
			request_chain.fail( function( jq_xhr_or_message, text_status, error_thrown ) {
				if ( error_callback ) {
					error_callback.call( request_context, jq_xhr_or_message, text_status, error_thrown );
				}
			} );
			return request_chain.promise();
		},
		/**
		 * Mark every layer and every content row as modified so save() sends batched delta payloads
		 * (used after bulk replace such as file import — avoids stale IDs and avoids one giant full-json request).
		 */
		should_migrate_chunk_storage_before_save: function() {
			var pc_storage = this.admin_data && this.admin_data.get( 'pc_storage' );
			return !!( pc_storage && pc_storage.needs_batch_migration );
		},
		/**
		 * Server: verify integrity, strip legacy blobs when safe, bump storage_format_version.
		 *
		 * @return {jQuery.jqXHR|jQuery.Promise}
		 */
		run_chunk_storage_finalize_if_needed: function() {
			var app = this;
			var variation_id = ( this.options.product_type === 'variation' && this.options.product_id ) ? this.options.product_id : 0;
			return $.post( ajaxurl, {
				action: 'mkl_pc_finalize_chunked_storage',
				nonce: PC_lang.update_nonce,
				id: this.id,
				variation_id: variation_id,
			} ).done( function( response ) {
				if ( response && response.success && response.data && response.data.snapshot && app.admin_data ) {
					app.admin_data.set( 'pc_storage', response.data.snapshot );
				}
			} );
		},
		mark_all_layers_and_content_modified_for_save: function() {
			var layer_identifier;
			this.modified_layer_ids = {};
			var layers_collection = this.get_collection( 'layers' );
			if ( layers_collection && layers_collection.length ) {
				layers_collection.each( function( layer_model ) {
					layer_identifier = layer_model.get( '_id' );
					if ( layer_identifier ) {
						this.modified_layer_ids[ layer_identifier ] = true;
					}
				}.bind( this ) );
			}
			this.modified_content_layer_ids = {};
			var product_model = this.get_product();
			var content_collection = product_model && product_model.get( 'content' );
			if ( content_collection && content_collection.length ) {
				content_collection.each( function( content_row_model ) {
					layer_identifier = content_row_model.get( 'layerId' ) || content_row_model.id;
					if ( layer_identifier ) {
						this.modified_content_layer_ids[ String( layer_identifier ) ] = true;
					}
				}.bind( this ) );
			}
		},
		save_all: function( state, options ) {
			this.saving = 0;
			this.errors = [];
			this._chunk_storage_migration_ui = false;
			this._migration_messaging_keys = null;
			if ( _.indexOf( _.values( this.is_modified ), true ) != -1 ) {

				if ( this.should_migrate_chunk_storage_before_save() ) {
					this._pending_chunk_storage_finalize = true;
					this._chunk_storage_migration_ui = true;
					this.mark_all_layers_and_content_modified_for_save();
					var layers_for_migration = this.get_collection( 'layers' );
					var product_for_migration = this.get_product();
					var content_for_migration = product_for_migration && product_for_migration.get( 'content' );
					if ( layers_for_migration && layers_for_migration.length ) {
						this.is_modified.layers = true;
					}
					if ( content_for_migration && content_for_migration.length ) {
						this.is_modified.content = true;
					}
				}

				if ( state ) {
					state.$save_button.addClass('disabled');
					state.$save_all_button.addClass('disabled');
					state.$toolbar.addClass('saving');
					state.$el.addClass('saving');
				}
				var modified_collection_keys = [];
				_.each( this.is_modified, function( val, key ) {
					if ( val === true ) {
						modified_collection_keys.push( key );
					}
				} );
				if ( this._chunk_storage_migration_ui && window.MKL_PC_DataMigrationOverlay ) {
					this._migration_messaging_keys = [];
					for ( var mki = 0; mki < modified_collection_keys.length; mki++ ) {
						var mk = modified_collection_keys[ mki ];
						if ( mk === 'layers' || mk === 'content' ) {
							this._migration_messaging_keys.push( mk );
						}
					}
					var firstMigrationPhase = this._migration_messaging_keys.length ? this._migration_messaging_keys[ 0 ] : 'finalize';
					window.MKL_PC_DataMigrationOverlay.show( firstMigrationPhase );
				}
				this.saving = modified_collection_keys.length;
				var app = this;
				var save_all_chain = $.when();
				modified_collection_keys.forEach( function( collection_key, index ) {
					save_all_chain = save_all_chain.then( function() {
						var save_promise_or_other = app.save( collection_key, app.get_collection( collection_key ), {
							success: _.bind( app.saved_all, app, collection_key, state, options ),
							error: _.bind( app.error_saving, app, collection_key, state, options ),
							data: {
								saveCache: index === modified_collection_keys.length - 1
							}
						} );
						if ( save_promise_or_other && typeof save_promise_or_other.then === 'function' ) {
							return save_promise_or_other;
						}
						// save() normally returns a promise; false is only used for skipped saves (legacy).
						return $.when( true );
					} );
				} );
			} else {
				if ( options && options.saved_all ) options.saved_all();
			}

			// if ( this.saving == 0 ) this.admin.close();
		},

		error_saving: function( key, state, options, error, a, b ) {
			this.saving--;
			if ( this.saving == 0 ) {
				if ( this._chunk_storage_migration_ui && window.MKL_PC_DataMigrationOverlay ) {
					window.MKL_PC_DataMigrationOverlay.hide();
				}
				this._chunk_storage_migration_ui = false;
				this._migration_messaging_keys = null;
				state.state_saved( 1 );
				if ( error && 'string' == typeof error && error.length > 0 ) this.errors.push( error );
				if ( error && 'object' == typeof error ) {
					const type = error?.status || 'unknown';
					const response = error?.responseJSON;
					this.errors.push( 'Error type: ' + type );
					if ( response && response.data && response.data.message ) this.errors.push( 'Error message: ' + response.data.message );
					if ( !response && error?.responseText ) this.errors.push( 'Error response: ' + error.responseText );
				}
				console.log( key, state, options, error, a, b, this.errors );
				alert( this.errors.join( "\n" ) );
			}
		},
		saved_all: function( key, state, options ) {
			this.saving--;
			this.is_modified[ key ] = false;
			if ( key === 'layers' ) { this.modified_layer_ids = {}; this.deleted_layer_ids = []; }
			if ( key === 'content' ) this.modified_content_layer_ids = {};
			if ( options && options.saved_one ) options.saved_one( key );
			if ( this._chunk_storage_migration_ui && this._migration_messaging_keys && window.MKL_PC_DataMigrationOverlay ) {
				var migKeys = this._migration_messaging_keys;
				var migIdx = migKeys.indexOf( key );
				if ( migIdx >= 0 && migKeys[ migIdx + 1 ] && this.saving > 0 ) {
					window.MKL_PC_DataMigrationOverlay.setPhase( migKeys[ migIdx + 1 ] );
				} else if ( this.saving > 0 && ( migIdx === -1 || migIdx === migKeys.length - 1 ) ) {
					window.MKL_PC_DataMigrationOverlay.setPhase( 'other' );
				}
			}
			if ( this.saving == 0 ) {

				var app = this;
				var pc_storage = this.admin_data && this.admin_data.get( 'pc_storage' );
				var run_finalize = this._pending_chunk_storage_finalize || ( pc_storage && pc_storage.needs_format_finalize );
				this._pending_chunk_storage_finalize = false;
				var finish_save_all_ui = function() {
					if ( state && state.state_saved ) {
						state.state_saved();
					}
					if ( options && options.saved_all ) {
						options.saved_all();
					}
				};
				if ( run_finalize ) {
					if ( this._chunk_storage_migration_ui && window.MKL_PC_DataMigrationOverlay ) {
						window.MKL_PC_DataMigrationOverlay.setPhase( 'finalize' );
					}
					var finalizeXhr = this.run_chunk_storage_finalize_if_needed();
					if ( this._chunk_storage_migration_ui && window.MKL_PC_DataMigrationOverlay ) {
						finalizeXhr.done( function() {
							window.MKL_PC_DataMigrationOverlay.setPhase( 'complete' );
						} );
						finalizeXhr.fail( function() {
							window.MKL_PC_DataMigrationOverlay.hide();
						} );
					}
					finalizeXhr.always( finish_save_all_ui );
				} else {
					finish_save_all_ui();
					if ( this._chunk_storage_migration_ui && window.MKL_PC_DataMigrationOverlay ) {
						window.MKL_PC_DataMigrationOverlay.setPhase( 'complete' );
					}
				}

			}
			PC.app.modified_choices = []; 

		},
		save: function( what, collection, options ) {
			if ( ! what || ! collection ) {
				console.log( 'A collection name and data must be set in order to save proprerly.' );
				return;
			}
			var save_id = this.id;
			if ( this.options.product_type == 'variation' && ( 'content' == what || 'conditions' == what  ) ) {
				save_id = this.options.product_id;
			}
			// If we do not have the necessary nonce, fail immeditately.
			if ( ! PC_lang.update_nonce ) {
				console.log('nonce problem');
				return $.Deferred().rejectWith( this ).promise();
			}
			if ( ! this.is_modified[what] ) {
				console.log('not modified');
				return false;
			}

			options = options || {};
			options.context = this;
			options.timeout = parseInt( wp.hooks.applyFilters( 'mkl_pc_admin.save_timeout', PC_lang.timeout || 30000 ) );
			
			// Set the action and ID.
			options.data = _.extend( options.data || {}, {
				action:  PC.setActionParameter,
				id:      save_id,
				nonce:   PC_lang.update_nonce,
				data: what,
				// id: wp.media.model.settings.post.id
			});

			if ( save_id != this.id ) {
				options.data.parent_id = this.id;
			}

			if ( collection.length > 0 ) {

				if ( 'layers' === what && collection instanceof Backbone.Collection ) {
					var layers_structure_index = collection.pluck( '_id' ).filter( function( layer_id_value ) { return layer_id_value; } );
					var modified_layer_map = PC.app.modified_layer_ids && typeof PC.app.modified_layer_ids === 'object' ? PC.app.modified_layer_ids : {};
					var modified_layer_key_list = Object.keys( modified_layer_map );
					var has_deleted_layers = PC.app.deleted_layer_ids && PC.app.deleted_layer_ids.length > 0;
					if ( modified_layer_key_list.length > 0 || has_deleted_layers ) {
						var ordered_layer_ids_for_save = this.order_modified_layer_ids_for_save( layers_structure_index, modified_layer_map );
						var layer_save_batches = this.build_layers_delta_batches( collection, layers_structure_index, ordered_layer_ids_for_save, PC.app.deleted_layer_ids || [] );
						if ( layer_save_batches.length > 1 ) {
							return this.send_configurator_save_batches( what, layer_save_batches, options );
						}
						options.data[what] = JSON.stringify( layer_save_batches.length ? layer_save_batches[ 0 ] : { layers_index: layers_structure_index, layers: {}, deleted: PC.app.deleted_layer_ids || [] } );
					} else {
						options.data[what] = JSON.stringify( collection );
					}
				} else if ( 'content' === what && collection instanceof Backbone.Collection ) {
					var modified_content_layer_map = PC.app.modified_content_layer_ids && typeof PC.app.modified_content_layer_ids === 'object' ? PC.app.modified_content_layer_ids : {};
					var modified_content_key_list = Object.keys( modified_content_layer_map );
					if ( modified_content_key_list.length > 0 ) {
						options.data.modified_choices = PC.app.modified_choices;
						var ordered_content_layer_ids_for_save = this.order_modified_content_layer_ids_for_save( collection, modified_content_layer_map );
						var content_save_batches = this.build_content_delta_batches( collection, ordered_content_layer_ids_for_save );
						if ( content_save_batches.length > 1 ) {
							return this.send_configurator_save_batches( what, content_save_batches, options );
						}
						options.data[what] = JSON.stringify( content_save_batches.length ? content_save_batches[ 0 ] : { content: {} } );
					} else {
						options.data[what] = JSON.stringify( collection );
						options.data.modified_choices = PC.app.modified_choices;
					}
				} else if ( collection instanceof Array ) {
					options.data[what] = {};
					$.each( collection, function( index, value ) {
						options.data[what][index] = ( value instanceof Backbone.Collection ) ? JSON.stringify( value ) : value;
					} );
				} else if ( collection instanceof Backbone.Collection ) {
					options.data[what] = JSON.stringify( collection );
					if ( 'content' == what ) {
						options.data.modified_choices = PC.app.modified_choices;
					}
				}
			} else {
				options.data[what] = 'empty';
			}

			// Record the values of the changed attributes.
			// if ( model.hasChanged() ) {
			// 	options.data.changes = {};

			// 	_.each( model.changed, function( value, key ) {
			// 		options.data.changes[ key ] = this.get( key );
			// 	}, this );
			// }

			return wp.ajax.send( options );
		},

		get_new_id: function( collection ){
			if ( collection.length < 1 ) 
				return 1;

			var maxw = collection.max( function( model ) { 
				return model.id ;
			});

			return parseInt( maxw.id ) + 1;
			
		},

		get_new_order: function( collection ){
			if ( ! collection.length ) {
				return 1;
			}
			return collection.last().get( 'order' ) + 1;
		},

		new_attributes: function( col, data ) {
			var m = _.extend( data, {
				_id: this.get_new_id( col ),
				order: this.get_new_order( col ),
				active: true
			} );
			return m;
		},

		get_data_from_clipboard: function() {
			// PCCOPY-choices-
		}
	};

	PC.selection_collection = Backbone.Collection.extend( {
		comparator: 'order',
		adding_group: false,
		modelId: function( attrs ) {
			return attrs._id;
		},
		is_multiple: function() {
			return !! ( this.length > 1 );
		},
		select: function( item_view ) {
			if ( this.adding_group ) return;
			var item = item_view.model;
			this.remove( this.get( item.id ) );
			if ( item.get( 'active' ) ) {
				this.add( { _id: item.id, view: item_view, order: item.get( 'order' ) } );
			}
		},
	} );

	PC.selection = new PC.selection_collection();

	PC.media = PC.media || {
		frame: function() {

			if ( this._frame )
				return this._frame; 

			this._frame = wp.media( { 
				title: PC.lang.media_title || 'Select An Image', 
				button: {
					text: PC.lang.media_select_button || 'Select',
				},
				multiple: false,
				library: {
					type: 'image'
				}
			} );

			this._frame.on( 'ready', this.ready ); 

			this._frame.state( 'library' ).on( 'select', this.select ); 

			this._frame.on( 'close', this.close );
			//
			// -> Set the selection on open.
			//
			// media_frame.on('open',function() {
			// 	var selection = media_frame.state().get('selection');
			// 	var id = 33;
			// 	var attachment = wp.media.attachment(id);
			// 	attachment.fetch();
			// 	selection.add( attachment ? [ attachment ] : [] );
			// });      

			return this._frame;
		},

		ready: function() {
			// $( '.media-modal' ).addClass( 'no-sidebar smaller' ); 
		},

		select: function() {
			var settings = wp.media.view.settings,
				selection = this.get( 'selection' ).single();
				if ( PC.media.target ) {
					PC.media.target.trigger('select-media', selection );
				}
			// media.showAttachmentDetails( selection );
			// var selection = that.frame().state().get('selection');

		},
		close: function() {
			this.admin = this.admin || PC.app.get_admin();
			this.admin_modal = this.admin_modal || this.admin.get_current_modal();
			this.admin_modal.$el.show();
		},

		open: function( options ) {
			this.admin = this.admin || PC.app.get_admin();
			this.admin_modal = this.admin_modal || this.admin.get_current_modal();
			this.admin_modal.$el.hide();
			if ( options instanceof jQuery ){
				this.target = options;
			} else if ( options.el ) {
				this.target = options.el;
			}

			// if ( options.selection ) 
			// 	that.frame().options.button.text = 'Change';

			this.frame().on( 'open', function() {
				var selection = this.frame().state().get('selection');
				if ( options.selection ) {
					var id = options.selection; 
					var attachment = wp.media.attachment(id); 
					selection.add( attachment ? [ attachment ] : [] ); 
				} else {
					selection.reset(null);
				}
			}.bind( this ) );
			this.frame().open();
		}

	};

	PC.copy_items = function( view ) {
		var data = {
			type: null,
			models: []
		};

		if ( view.collection instanceof PC.layers ) {
			data.type = 'layers';
		} else if ( view.collection instanceof PC.choices ) {
			data.type = 'choices';
		} else if ( view.collection instanceof PC.angles ) {
			data.type = 'angles';
		}
		if ( !data.type ) return;

		// Parse the selection
		PC.selection.each( item => {
			// Layers: include content data
			if ( 'layers' == data.type || 'angles' == data.type ) {
				const content = PC.app.get_layer_content( item.get( 'view' )?.model?.id );
				var item_data = {
					layer: item.get( 'view' ).model.toJSON(),
					content: content ? content.toJSON() : []
				}
				data.models.push( item_data );
			} else {
				// Choices: individual models only
				data.models.push( item.get( 'view' ).model.toJSON() );
			}
		} );

		navigator.clipboard.writeText( JSON.stringify( data ) )
			.then( c => {
				PC.show_notice( 'Configuration copied to clipboard. Go to "Edit > Paste" or "Ctrl/Cmd + v" to paste.' );
			} );
	};

	PC.show_notice = function( msg, type = 'success' ) {
		const el = document.createElement( 'div' );
		const target = PC.app.get_product().editor.$( '.notice-container' )[ 0 ];
		if ( !target ) return;
		el.className = `pc-notice notice-${type}`;
		el.innerText = msg;
		const icon = document.createElement( 'span' );
		if ( 'success' == type ) {
			icon.className = 'dashicons dashicons-saved';
			el.prepend( icon );
		}
		if ( 'error' == type ) {
			icon.className = 'dashicons dashicons-no';
			el.prepend( icon );
		}
		if ( 'saved' == type ) {
			icon.className = 'dashicons dashicons-saved';
			el.prepend( icon );
			if ( $( '#sample-permalink' ).length ) {
				const a = $( '#sample-permalink a' ).first();
				const view_link = document.createElement( 'a' );
				view_link.href = a[ 0 ].href;
				view_link.className = 'view-product';
				view_link.target = "_blank";
				el.append( view_link );
			}
		}
		target.appendChild(el);
		setTimeout(() => el.remove(), 5000);
	}


} ) ( jQuery, PC._us || window._ );