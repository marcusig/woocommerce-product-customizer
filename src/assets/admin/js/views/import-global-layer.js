var PC = PC || {};
PC.views = PC.views || {};

(function ( $, _ ) {
	'use strict';

	PC.views.import_global_layer = PC.views.admin_dialog.extend( {
		itemTemplate: wp.template( 'mkl-pc-global-layer-item' ),

		events: {
			'click [data-mkl-pc-dialog-dismiss]': 'close',
			'click .mkl-pc-admin-dialog__cancel': 'close',
			'click .cancel': 'close',
			'click .import-selected': 'import_selected',
			'change input[name="global_layer_selection"]': 'on_selection_change',
			'input .global-layers-filter': 'on_filter_input',
			'keyup .global-layers-filter': 'on_filter_input',
		},

		initialize: function ( options ) {
			this.options = options || {};
			this.selected_global_id = null;
			this.layers = [];
			var title =
				typeof PC_lang !== 'undefined' && PC_lang.import_global_layer_title
					? PC_lang.import_global_layer_title
					: '';
			PC.views.admin_dialog.prototype.initialize.call(
				this,
				_.extend(
					{
						title: title,
						extraClass: 'mkl-pc-admin-dialog--import-global-layer',
					},
					this.options
				)
			);
			this.$list = this.$body.find( '.global-layers-list' );
			this.$filter = this.$body.find( '.global-layers-filter' );
			this.$importBtn = this.$body.find( '.import-selected' );
			this.$spinner = this.$body.find( '.mkl-pc-spinner' );
			this.fetch_layers();
		},

		renderDialogBody: function () {
			return wp.template( 'mkl-pc-import-global-layer' )();
		},

		on_filter_input: function ( e ) {
			var filter_value = $( e.currentTarget )
				.val()
				.toLowerCase()
				.trim();
			this.filter_layers( filter_value );
		},

		fetch_layers: function () {
			var self = this;
			this.$spinner.addClass( 'is-active' );

			wp.ajax
				.post( {
					action: 'mkl_pc_list_global_layers',
					nonce:
						window.PC_lang && PC_lang.global_layers_nonce
							? PC_lang.global_layers_nonce
							: undefined,
				} )
				.done( function ( response ) {
					self.$spinner.removeClass( 'is-active' );
					if ( response.layers ) {
						self.layers = response.layers;
						self.render_layers();
					} else {
						self.$list.html(
							'<p>' +
								( PC.lang && PC.lang.no_global_layers
									? PC.lang.no_global_layers
									: 'No global layers found.' ) +
								'</p>'
						);
					}
				} )
				.fail( function ( error ) {
					self.$spinner.removeClass( 'is-active' );
					self.$list.html(
						'<p class="error">' +
							( error.message || 'Error loading global layers.' ) +
							'</p>'
					);
					console.error( 'Error fetching global layers:', error );
				} );
		},

		render_layers: function () {
			var self = this;
			this.$list.empty();

			if ( ! this.layers.length ) {
				this.$list.html(
					'<p>' +
						( PC.lang && PC.lang.no_global_layers
							? PC.lang.no_global_layers
							: 'No global layers found.' ) +
						'</p>'
				);
				return;
			}

			_.each( this.layers, function ( layer ) {
				var $item = $( self.itemTemplate( layer ) );
				self.$list.append( $item );
			} );
		},

		filter_layers: function ( filter_value ) {
			if ( ! filter_value ) {
				this.$list.find( '.global-layer-item' ).show();
				return;
			}

			var self = this;
			this.$list.find( '.global-layer-item' ).each( function () {
				var $item = $( this );
				var $label = $item.find( 'h4' );
				var layerName = $label.text().toLowerCase();
				var globalId = $item.data( 'global-id' );
				var layer = _.find( self.layers, function ( l ) {
					return l.global_id == globalId;
				} );

				var matches = false;
				if ( layer ) {
					if ( layer.name && layer.name.toLowerCase().indexOf( filter_value ) !== -1 ) {
						matches = true;
					}
					if (
						! matches &&
						layer.admin_label &&
						layer.admin_label.toLowerCase().indexOf( filter_value ) !== -1
					) {
						matches = true;
					}
				}

				if ( matches ) {
					$item.show();
				} else {
					$item.hide();
				}
			} );
		},

		on_selection_change: function ( e ) {
			this.selected_global_id = $( e.currentTarget ).val();
			this.$importBtn.prop( 'disabled', ! this.selected_global_id );
		},

		import_selected: function () {
			if ( ! this.selected_global_id ) {
				return;
			}

			var self = this;
			var global_id = parseInt( this.selected_global_id, 10 );

			var importingLabel =
				typeof PC_lang !== 'undefined' && PC_lang.import_global_layer_importing
					? PC_lang.import_global_layer_importing
					: 'Importing…';
			this.$importBtn.prop( 'disabled', true ).text( importingLabel );

			PC.app.get_global_layers().fetch_global_layer( global_id, {
				success: function ( model, response ) {
					if ( response && response.layer ) {
						var layers_col = PC.app.admin.layers;
						var new_layer_id = PC.app.get_new_id( layers_col );
						var new_order = layers_col.nextOrder
							? layers_col.nextOrder()
							: layers_col.length + 1;

						var new_layer_data = _.extend( {}, response.layer, {
							_id: new_layer_id,
							id: new_layer_id,
							order: new_order,
							is_global: true,
							global_id: global_id,
							active: false,
						} );

						var new_layer = layers_col.create( new_layer_data );
						PC.app.is_modified.layers = true;

						if ( response.content ) {
							var processed_content = PC.app
								.get_global_layers()
								.process_content_layer_id( response.content, new_layer_id );
							self.add_layer_to_configurator(
								new_layer,
								processed_content,
								global_id,
								new_layer_id
							);
						} else {
							self.add_layer_to_configurator( new_layer, null, global_id, new_layer_id );
						}

						self.close();
					} else {
						alert( 'Error: Could not fetch layer data.' );
						self.reset_import_button_label();
					}
				},
				error: function ( model, error ) {
					alert(
						'Error fetching layer: ' + ( error.message || 'Unknown error' )
					);
					console.error( 'Error fetching global layer:', error );
					self.reset_import_button_label();
				},
			} );
		},

		reset_import_button_label: function () {
			var label =
				typeof PC_lang !== 'undefined' && PC_lang.import_selected
					? PC_lang.import_selected
					: 'Import Selected';
			this.$importBtn.prop( 'disabled', false ).text( label );
		},

		add_layer_to_configurator: function (
			new_layer,
			content_data,
			global_id,
			new_layer_id
		) {
			var content_col = PC.app.get_product().get( 'content' );

			if ( content_data && Array.isArray( content_data ) && content_data.length ) {
				var new_choices_col = new PC.choices( [], { layer: new_layer } );
				content_col.add( {
					layerId: new_layer_id,
					choices: new_choices_col,
					global_id: global_id,
				} );

				_.each( content_data, function ( choice_data ) {
					var new_choice_id = PC.app.get_new_id( new_choices_col );
					var choice_order = new_choices_col.nextOrder
						? new_choices_col.nextOrder()
						: new_choices_col.length + 1;

					var new_choice_data = _.extend( {}, choice_data, {
						_id: new_choice_id,
						id: new_choice_id,
						layerId: new_layer_id,
						order: choice_order,
					} );

					var new_choice = new_choices_col.create( new_choice_data );
					PC.app.modified_choices.push(
						new_choice.get( 'layerId' ) + '_' + new_choice.id
					);
				} );

				PC.app.is_modified.content = true;
			}

			wp.hooks.doAction( 'PC.admin.global_layer_imported', new_layer, global_id );
		},
	} );
})( jQuery, PC._us || window._ );
