var PC = PC || {};
PC.views = PC.views || {};

(function($, _){
	'use strict';

	PC.views.import_global_layer = Backbone.View.extend({
		tagName: 'div',
		className: 'media-modal wp-core-ui pc-modal import-global-layer-modal',
		template: wp.template('mkl-pc-import-global-layer'),
		itemTemplate: wp.template('mkl-pc-global-layer-item'),
		
		events: {
			'click .cancel': 'close',
			'click .import-selected': 'import_selected',
			'change input[name="global_layer_selection"]': 'on_selection_change',
			'input .global-layers-filter': 'on_filter_input',
			'keyup .global-layers-filter': 'on_filter_input',
		},

		initialize: function( options ) {
			this.options = options || {};
			this.selected_global_id = null;
			this.layers = [];
			this.render();
			this.fetch_layers();
		},

		render: function() {
			var modal_html = wp.template('mkl-modal')({});
			var content_html = this.template();
			$('body').append( this.$el.html( modal_html ) );
			
			// Add the content to the modal
			this.$el.find('.media-frame').html( content_html );
			
			// Add backdrop
			if ( ! this.$el.next('.media-modal-backdrop').length ) {
				this.$el.after( '<div class="media-modal-backdrop pc-modal-backdrop"></div>' );
				this.$backdrop = this.$el.next('.media-modal-backdrop');
				this.$backdrop.on( 'click', this.close.bind( this ) );
			}
			
			// Add close button handler
			this.$el.find('.media-modal-close').on( 'click', this.close.bind( this ) );
			
			this.$list = this.$('.global-layers-list');
			this.$filter = this.$('.global-layers-filter');
			this.$importBtn = this.$('.import-selected');
			this.$spinner = this.$('.spinner');
			return this;
		},

		on_filter_input: function( e ) {
			var filter_value = $( e.currentTarget ).val().toLowerCase().trim();
			this.filter_layers( filter_value );
		},

		fetch_layers: function() {
			var self = this;
			this.$spinner.addClass('is-active');
			
			wp.ajax.post({
				action: 'mkl_pc_list_global_layers',
				nonce: ( window.PC_lang && PC_lang.global_layers_nonce ) ? PC_lang.global_layers_nonce : undefined
			}).done(function( response ) {
				self.$spinner.removeClass('is-active');
				if ( response.layers ) {
					self.layers = response.layers;
					self.render_layers();
				} else {
					self.$list.html( '<p>' + PC.lang?.no_global_layers || 'No global layers found.' + '</p>' );
				}
			}).fail(function( error ) {
				self.$spinner.removeClass('is-active');
				self.$list.html( '<p class="error">' + ( error.message || 'Error loading global layers.' ) + '</p>' );
				console.error( 'Error fetching global layers:', error );
			});
		},

		render_layers: function() {
			var self = this;
			this.$list.empty();
			
			if ( ! this.layers.length ) {
				this.$list.html( '<p>' + ( PC.lang?.no_global_layers || 'No global layers found.' ) + '</p>' );
				return;
			}

			_.each( this.layers, function( layer ) {
				var $item = $( self.itemTemplate( layer ) );
				self.$list.append( $item );
			});
		},

		filter_layers: function( filter_value ) {
			if ( ! filter_value ) {
				this.$list.find('.global-layer-item').show();
				return;
			}
			
			var self = this;
			this.$list.find('.global-layer-item').each(function() {
				var $item = $(this);
				var $label = $item.find('h4');
				var layerName = $label.text().toLowerCase();
				// Get the layer data from the DOM
				var globalId = $item.data('global-id');
				var layer = _.find( self.layers, function( l ) {
					return l.global_id == globalId;
				});
				
				var matches = false;
				if ( layer ) {
					// Check name
					if ( layer.name && layer.name.toLowerCase().indexOf( filter_value ) !== -1 ) {
						matches = true;
					}
					// Check admin_label (if name didn't match)
					if ( ! matches && layer.admin_label && layer.admin_label.toLowerCase().indexOf( filter_value ) !== -1 ) {
						matches = true;
					}
				}
				
				if ( matches ) {
					$item.show();
				} else {
					$item.hide();
				}
			});
		},

		on_selection_change: function( e ) {
			this.selected_global_id = $( e.currentTarget ).val();
			this.$importBtn.prop( 'disabled', ! this.selected_global_id );
		},

		import_selected: function( e ) {
			if ( ! this.selected_global_id ) return;

			var self = this;
			var global_id = parseInt( this.selected_global_id, 10 );
			
			this.$importBtn.prop( 'disabled', true ).text( 'Importing...' );

			// Fetch the full global layer (including content)
			PC.app.get_global_layers().fetch_global_layer( global_id, {
				success: function( model, response ) {
					if ( response && response.layer && response.content ) {
						self.add_layer_to_configurator( response.layer, response.content, global_id );
						self.close();
					} else {
						alert( 'Error: Could not fetch layer data.' );
						self.$importBtn.prop( 'disabled', false ).text( PC.lang?.import_selected || 'Import Selected' );
					}
				},
				error: function( model, error ) {
					alert( 'Error fetching layer: ' + ( error.message || 'Unknown error' ) );
					console.error( 'Error fetching global layer:', error );
					self.$importBtn.prop( 'disabled', false ).text( PC.lang?.import_selected || 'Import Selected' );
				}
			});
		},

		add_layer_to_configurator: function( layer_data, content_data, global_id ) {
			var layers_col = PC.app.admin.layers;
			var content_col = PC.app.get_product().get( 'content' );

			// Generate new IDs for the layer
			var new_layer_id = PC.app.get_new_id( layers_col );
			var new_order = layers_col.nextOrder ? layers_col.nextOrder() : ( layers_col.length + 1 );

			// Prepare layer data
			var new_layer_data = _.extend( {}, layer_data, {
				_id: new_layer_id,
				id: new_layer_id,
				order: new_order,
				is_global: true,
				global_id: global_id,
				active: false
			});

			// Create the layer
			var new_layer = layers_col.create( new_layer_data );
			PC.app.is_modified.layers = true;

			// Prepare content data if it exists
			// content_data can be either an array of content entries or a single content entry
			if ( content_data ) {
				var choices_data = null;
				
				// If it's an array, find the content entry for this layer
				if ( Array.isArray( content_data ) ) {
					// Check if it's an array of content entries (each with layerId and choices)
					if ( content_data.length > 0 && content_data[0].layerId !== undefined ) {
						// Find the entry matching this layer (though for global layers, there should be only one)
						var content_entry = content_data[0];
						choices_data = content_entry.choices || [];
					} else {
						// It's an array of choices directly
						choices_data = content_data;
					}
				} else if ( content_data.choices ) {
					// It's a single content entry object
					choices_data = content_data.choices;
				}

				if ( choices_data && Array.isArray( choices_data ) && choices_data.length ) {
					var new_choices_col = new PC.choices( [], { layer: new_layer } );
					content_col.add({ 
						layerId: new_layer_id, 
						choices: new_choices_col,
						global_id: global_id
					});

					_.each( choices_data, function( choice_data ) {
						var new_choice_id = PC.app.get_new_id( new_choices_col );
						var choice_order = new_choices_col.nextOrder ? new_choices_col.nextOrder() : ( new_choices_col.length + 1 );
						
						var new_choice_data = _.extend( {}, choice_data, {
							_id: new_choice_id,
							id: new_choice_id,
							layerId: new_layer_id,
							order: choice_order
						});

						var new_choice = new_choices_col.create( new_choice_data );
						PC.app.modified_choices.push( new_choice.get( 'layerId' ) + '_' + new_choice.id );
					});

					PC.app.is_modified.content = true;
				}
			}

			// Trigger event to notify that a layer was imported
			wp.hooks.doAction( 'PC.admin.global_layer_imported', new_layer, global_id );
		},

		open: function() {
			this.$el.show();
			$('body').addClass('pc-modal-opened');
		},

		close: function() {
			this.$el.hide();
			if ( this.$backdrop ) {
				this.$backdrop.hide();
			}
			$('body').removeClass('pc-modal-opened');
			this.remove();
		}
	});

})(jQuery, PC._us || window._);

