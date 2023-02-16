var PC = window.PC || {};
PC.import = PC.import || {};
PC.import.models = PC.import.models || {};
PC.import.views = PC.import.views || {};
( function( $, Import, _ ) {
	/**
	 * Main import state view
	 */
	PC.views.import = Backbone.View.extend({
		tagName: 'div',
		className: 'state layers-state', 
		template: wp.template('mkl-pc-import-export'),
		events: {
			'click button[data-action]': 'get_action',
		},
		initialize: function( options ) {
			console.log('View Import');
			Import.state = this;
			this.options = options;
			this.render();
		},
		render: function() {
			this.$el.append( this.template() );
			this.tool_container = this.$el.find( '.importer-action-content' );
		},
		get_action: function(e) {
			var action = $(e.currentTarget).data( 'action' );
			switch ( action ) {
				case 'export-data':
					this.export();
					break;
				case 'import-from-product':
					this.show_tool( 'import_from_product' );
					break;
				case 'import-from-file':
					this.show_tool( 'import_from_file' );
					break;
				case 'return':
					this.return();
					break;
			}
		},
		show_tool: function( view_name ) {
			// if ( ! Import.views.hasOwnProperty( view_name ) ) return;
			if ( this.current_tool ) this.current_tool.remove();
			this.$el.addClass( 'showing-tool' );
			// var import_from_products_steps = [
			// 	{
			// 		viewName: 'product',
			// 		label: 'Product selection',
			// 	},
			// 	{
			// 		viewName: 'layers',
			// 		label: 'Layer options',
			// 	},
			// 	{
			// 		viewName: 'angles',
			// 		label: 'Angles options',
			// 	},
			// 	{
			// 		viewName: 'content',
			// 		label: 'Content options'
			// 	},
			// 	{
			// 		viewName: 'end',
			// 		label: 'Finished import'
			// 	},
			// ];
			this.current_tool = new Import.views.importer( {
				steps: [
					{
						viewName: 'file_upload',
						label: 'Upload configuration',
					},
					{
						viewName: 'configuration_preview',
						label: 'Preview',
					},
					{
						viewName: 'configuration_imported',
						label: 'Import completed',
					},
				]
			} );
			
			console.log(this.current_tool);
			
			this.current_tool.$el.appendTo( this.tool_container );
		},
		return: function() {
			this.$el.removeClass( 'showing-tool' );
			this.current_tool.remove();
		},
		export: function() {
			// exportToJsonFile
			var data = {};
			data.layers = PC.app.get_collection( 'layers' );
			data.angles = PC.app.get_collection( 'angles' );
			data.content = PC.app.get_collection( 'content' );
			if ( PC.views.conditional ) {
				// maybe fetch the conditions, then run the export again
				var product = PC.app.get_product(); 

				if( ! product.get( 'conditions' ) ) {
					var conditions = new PC.conditionsCollection();
					
					product.set( 'conditions' , conditions );
					console.log('fetching conditions');
					conditions.fetch({
						url: conditions.url() + '&id=' + product.id,
						success: function( a, b ) {
							this.export();
						}.bind( this ),
						error: function( a, b ) {
							console.log('error', a, b);
						}
					});
					return;
				}

				data.conditions = PC.app.get_collection( 'conditions' );
			}

			exportToJsonFile( data );
			
		},
	});

	Import.models.product_importer = Backbone.Model.extend( {
		url: function() {
			var action = PC.actionParameter,
				data = 'init';
			return ajaxurl + '?action='+action+'&data='+data+'&id='+this.id
		},
		initialize: function( attributes, options ) {
			this.on('sync', function( e, f, g ) {
				if ( options.on_fetched ) {
					options.on_fetched( e, f, g );
				}
			});
			this.fetch();
		},
		idAttribute: 'product_id',
		parse: function( response ) {
			var layers, angles;
			if ( response.layers && response.layers.length > 0 ) {
				layers = new PC.layers( response.layers, { product_id: this.id } );
			} else {
				layers = new PC.layers( [], { product_id: this.id } );
			}

			if ( response.angles && response.angles.length > 0 ) {
				angles = new PC.angles( response.angles, { product_id: this.id } );
			} else {
				angles = new PC.angles( [], { product_id: this.id } );
			}
			console.log(' parsing the response');
			
			return { angles: angles, layers: layers, nonces: response.nonces };

		},
		on_changed: function( model ) {
			console.log('changed', model);
		}
		// step: null,
		// product: null,
		// layers: null,
		// angles: null,
		// content: null,
		// settings: {}
	} );

	// Importer view - holds the steps to import something
	Import.views.importer = Backbone.View.extend({
		tagName: 'div',
		className: 'importer',
		template: wp.template('mkl-pc-importer'),
		events: {
			// 'click .importer-header a': 'on_click_header'
		},
		initialize: function( options ) {
			this.current_step = 0;
			this.steps = options.steps;
			this.views = [];
			this.render();
			this.show_step( this.steps[ this.current_step ].viewName );
		},
		render: function() {
			this.$el.append( this.template( { menu_items: this.steps } ) );
		},
		// on_click_header: function( e ) {
		// 	e.preventDefault();
		// 	var link = $( e.currentTarget );
		// 	this.show_step( link.data( 'v' ) );
		// },
		show_step: function( view_name ) {
			if ( ! Import.views.importerViews.hasOwnProperty( view_name ) ) {
				alert( 'This step does not exist' );
				return;
			}
			this.$el.find( '.importer-header li' ).removeClass( 'active' );
			this.$el.find( '.importer-header li' ).eq( this.current_step ).addClass( 'active' );
			if ( this.views[ this.current_step ] ) this.views[ this.current_step ].remove();
			this.views[ this.current_step ] = new Import.views.importerViews[ view_name ]();
			this.views[ this.current_step ].$el.appendTo( this.$el.find( '.importer-container' ) );
		},
		next: function() {
			if ( ! this.steps[ this.current_step + 1 ] ) return;
			if ( this.views[ this.current_step ] ) this.views[ this.current_step ].remove();
			this.current_step ++;
			this.show_step( this.steps[ this.current_step ].viewName );
		}
	});
	
	Import.views.importerViews = {};

	Import.views.importerViews.product = Backbone.View.extend({
		tagName: 'div',
		className: 'importer',
		template: wp.template('mkl-pc-importer--product'),
		events: {
			'click .next': 'get_configuration',
			'select2:select .wc-product-search': 'on_select_product',
		},
		initialize: function() {
			this.render();
			setTimeout(
				function() {
					jQuery( document.body ).trigger( 'wc-enhanced-select-init' );
				},
				100
			);
		},
		render: function() {
			this.$el.append( this.template() );
		},
		get_configuration: function() {
			this.$el.addClass( 'loading' );
			Import.imported_product = new Import.models.product_importer(
				{ 
					product_id: this.selected.id,
					name: this.selected.text
				},
				{
					on_fetched: function( model ) {
						this.$el.removeClass( 'loading' );
						if ( ! model.get( 'layers' ).length ) {
							alert( 'No data found, select an other product.' );
							// Clear the model
							Import.imported_product.clear();
							return;
						}
						// Go to next step
						Import.state.current_tool.next();
						
					}.bind( this )
				}
			);
			// Import.imported_product.fetch();
			// .done( function(a, b, c) {
			// 	console.log('done fetching', a,b,c);
			// 	setTimeout(
			// 		function() {
			// 			console.log(Import.imported_product);
						
			// 		}.bind(this),
			// 		200
			// 	)
			// }.bind( this ) );
			// this.$el.removeClass( 'loading' );
			// if ( ! Import.imported_product.get( 'layers' ).length ) {
			// 	alert( 'This product does not have any data to import.' );
			// 	return;
			// }
			// alert( 'We have a configuration!' );
			
		},
		on_select_product: function( e ) {
			console.log( e );
			
			var selected = e.params.data.id;
			if ( selected ) {
				this.$el.find( '.next' ).prop( 'disabled', false );
				this.selected = e.params.data;
				return;
			}
			this.$el.find( '.next' ).prop( 'disabled', 'disabled' );
		}
	});

	Import.views.importerViews.file_upload = Backbone.View.extend({
		tagName: 'div',
		className: 'importer--upload',
		template: wp.template('mkl-pc-importer--file-upload'),
		events: {
			'change #jsonfileinput': 'open_json_file',
			'select2:select .wc-product-search': 'on_select_product',
		},
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.append( this.template() );
		},
		open_json_file: function( ef ) {
			var file_to_read = ef.currentTarget.files[0];
			if ( ! ef.currentTarget.files[0] ) return;
			var fileread = new FileReader();
			fileread.onload = function( e ) {
				var file_content = e.target.result;
				var configuration = JSON.parse( file_content ); // parse json 
				var collections = wp.hooks.applyFilters( 'PC.fe.import.collections', [ 'layers', 'content', 'angles', 'conditions' ] );
				_.each( collections, function( col_name ) {
					if ( ! configuration.hasOwnProperty( col_name ) ) return;
				} );
				Import.imported_data = Import.imported_data || {};
				Import.imported_data.collections = configuration;
				Import.state.current_tool.next();
			};
			fileread.readAsText( file_to_read );
		},
		on_select_product: function( e ) {
			console.log( e );
			
			var selected = e.params.data.id;
			if ( selected ) {
				this.$el.find( '.next' ).prop( 'disabled', false );
				this.selected = e.params.data;
				return;
			}
			this.$el.find( '.next' ).prop( 'disabled', 'disabled' );
		}
	});

	Import.views.importerViews.configuration_preview = Backbone.View.extend({
		tagName: 'div',
		className: 'importer',
		template: wp.template('mkl-pc-importer--configuration-preview'),
		events: {
			'change #jsonfileinput': 'open_json_file',
			'click .import-selected': 'process_import'
		},
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.append( this.template( Import.imported_data.collections ) );
		},
		open_json_file: function( ef ) {
			console.log( ef );
		},
		process_import: function() {
			// Import.imported_data.collections
			// Add the layers
			PC.app.admin_data.set( 'layers', Import.imported_data.collections.layers );
			// Add the angles
			PC.app.admin_data.set( 'angles', Import.imported_data.collections.angles );
			// Parse those
			PC.app.admin.set_data();

			PC.app.is_modified[ 'layers' ] = true;
			PC.app.is_modified[ 'angles' ] = true;
			
			// Add the content
			var new_content = PC.app.get_product().parse( Import.imported_data.collections );
			if ( new_content.hasOwnProperty( 'content' ) ) {
				PC.app.get_product().set( 'content', new_content.content );
				PC.app.is_modified[ 'content' ] = true;
			} else {
				alert( 'No content was imported' );
			}

			// Add the conditions
			if ( Import.imported_data.collections.conditions && PC.views.conditional ) {
				var conditions = this.col = new PC.conditionsCollection( Import.imported_data.collections.conditions );
				PC.app.get_product().set( 'conditions' , conditions );
				PC.app.is_modified[ 'conditions' ] = true;
			}

			// Hook
			wp.hooks.doAction( 'PC.admin.import.process_import', Import );

			Import.state.current_tool.next();
		}
	});

	Import.views.importerViews.configuration_imported = Backbone.View.extend({
		tagName: 'div',
		className: 'importer--complete',
		template: wp.template('mkl-pc-importer--configuration-imported'),
		events: {
			'click .save': 'save',
			'click .save-and-fix-images': 'save_and_fix',
		},
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.append( this.template() );
		},
		save: function( e ) {
			$( e.currentTarget ).addClass( 'disabled' ).prop( 'disabled', true );
			PC.app.save_all( false, { saved_all: this.on_saved.bind( this ) } );
		},
		on_saved: function() {
			console.log( 'saved', this );
			this.$( '.save' ).removeClass( 'disabled' ).prop( 'disabled', false );
		},
		save_and_fix: function( e ) {
			$( e.currentTarget ).addClass( 'disabled' ).prop( 'disabled', true );
			PC.app.save_all( false, { saved_all: this.fix.bind( this ) } );
		},
		fix: function() {
			if ( ! PC_lang.update_nonce ) {
				alert( 'A nonce for the request was not found!' );
			}
			var save_id = PC.app.id;
			if ( PC.app.options.product_type == 'variation' ) {
				save_id = PC.app.options.product_id;
			}
			wp.ajax.post({
				action: 'mkl_pc_fix_image_ids_config',
				security: PC_lang.update_nonce,
				id: save_id
			}).done( function( response ) {
				PC.app.admin_data.set( 'layers', response.layers );
				// Add the angles
				PC.app.admin_data.set( 'angles', response.angles );
				// Parse those
				PC.app.admin.set_data();
	
				// Add the content
				var new_content = PC.app.get_product().parse( response );

				if ( new_content.hasOwnProperty( 'content' ) ) {
					PC.app.get_product().set( 'content', new_content.content );
				}
	
				alert( 'The content was scanned and ' + response.changed_items + ' images where fixed.' );
				// btn.prop( 'disabled', false );
			} );			
		}

	});

	Import.views.importerViews.layers = Backbone.View.extend({
		tagName: 'div',
		className: 'importer',
		template: wp.template('mkl-pc-importer--layers'),
		events: {
			'click .next': 'next',
			'change input[name="which-layers"]': 'which_layers'
		},
		initialize: function() {
			this.render();
			this.$form = this.$el.find( '.form' );
		},
		render: function() {
			this.$el.append( this.template( { product_name: Import.imported_product.get( 'name' ) } ) );
			this.selector = new Import.views.selector( { colName: 'layers' } );
			this.$el.find( '.selector-container' ).append( this.selector.$el );
		},
		update_selector: function() {
			
		},
		next: function( e ) {
			e.preventDefault();
			// validate form
			// 1. Validate required inputs
			var valid = true;
			this.$form.find( 'input[required]' ).each(
				function( index, element ) {
					if ( ! element.checkValidity() ) valid = false;
				}
			);

			if ( ! valid ) {
				alert( 'The settings are not correct.');
				return;
			}

			var settings = {
				which: this.$form.find( 'input[name="which-layers"]' ).val(),
				behaviour: this.$form.find( 'input[name="existing-layers"]' ).val(),
				import_thumbnails: this.$form.find( 'input[name="layer-thumbnails"]' ).is( ':checked' ),
			};

			
			if ( 'selected' === settings.which ) {
				// 2. validate selected layers
				var selected = Import.imported_product.get( 'layers' ).where( { selected: true } );
				
				// console.log( selected, which, behaviour, import_thumbnails );
				
				if ( ! selected ) {
					alert( 'At least one layer must be selected.');
					return;				
				}
			}

			Import.imported_product.set( 'layerSettings', settings );

			Import.state.current_tool.next();

			
		},
		which_layers: function( e ) {
			if ( 'everything' === e.target.value ) {
				this.selector.$el.hide();
			} else {
				this.selector.$el.show();
			}
		}
	});
	
	Import.views.importerViews.angles = Backbone.View.extend({
		tagName: 'div',
		className: 'importer',
		template: wp.template('mkl-pc-importer--angles'),
		events: {
			'click .next': 'next',
			'change input[name="which-angles"]': 'which_angles'
		},
		initialize: function() {
			this.render();
			this.$form = this.$el.find( '.form' );
		},
		render: function() {
			this.$el.append( this.template( { product_name: Import.imported_product.get( 'name' ) } ) );
			this.selector = new Import.views.selector( { colName: 'angles' } );
			this.$el.find( '.selector-container' ).append( this.selector.$el );
		},
		update_selector: function() {
			
		},
		next: function( e ) {
			e.preventDefault();
			// validate form
			// 1. Validate required inputs
			var valid = true;
			this.$form.find( 'input[required]' ).each(
				function( index, element ) {
					if ( ! element.checkValidity() ) valid = false;
				}
			);

			if ( ! valid ) {
				alert( 'The settings are not correct.');
				return;
			}

			var settings = {
				which: this.$form.find( 'input[name="which-angles"]' ).val(),
				behaviour: this.$form.find( 'input[name="existing-angles"]' ).val(),
				import_thumbnails: this.$form.find( 'input[name="angle-thumbnails"]' ).is( ':checked' ),
			};

			
			if ( 'selected' === settings.which ) {
				// 2. validate selected angles
				var selected = Import.imported_product.get( 'angles' ).where( { selected: true } );
				
				// console.log( selected, which, behaviour, import_thumbnails );
				
				if ( ! selected ) {
					alert( 'At least one angle must be selected.');
					return;				
				}
			}

			Import.imported_product.set( 'angleSettings', settings );

			Import.state.current_tool.next();

			
		},
		which_layers: function( e ) {
			if ( 'everything' === e.target.value ) {
				this.selector.$el.hide();
			} else {
				this.selector.$el.show();
			}
		}
	});
	
	Import.views.selector = Backbone.View.extend( {
		tagName: 'div',
		className: 'selector',
		template: wp.template('mkl-pc-importer--selector'),
		initialize: function( options ) {
			this.colName = options.colName;
			this.render();
			this.listenTo( Import.imported_product.get( this.colName ), 'change:selected', this.add_item );
		},
		render: function() {
			this.$el.append( this.template() );
			this.$selected = this.$el.find( '.selected' );
			this.$available = this.$el.find( '.available' );
			Import.imported_product.get( this.colName ).each( this.add_item, this );
			
		},
		add_item: function( model ) {
			var item = new Import.views.selectorItem( { model: model } );
			if ( model.get( 'selected' ) ) {
				item.$el.appendTo( this.$selected );
			} else {
				item.$el.appendTo( this.$available );
			}
		},
		move_item: function( model ) {
			
		}
	} );

	Import.views.selectorItem = Backbone.View.extend( {
		tagName: 'li',
		template: wp.template('mkl-pc-importer--selector-item'),
		events: {
			'click a': 'changeSelection',
		},
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.append( this.template( this.model.attributes ) );
		},
		changeSelection: function(e) {
			e.preventDefault();
			this.remove()
			this.model.set( 'selected', ! this.model.get( 'selected' ) );
		}
	} );

	var exportToJsonFile = function ( jsonData ) {
		var dataStr = JSON.stringify( jsonData );
		var dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent( dataStr );
		var dd = new Date();
		var exportFileDefaultName = 'configurator-data--product-' + PC.app.get_product().id + '--' + dd.toISOString() + '.json';
	
		var linkElement = document.createElement( 'a' );
		linkElement.setAttribute( 'href', dataUri );
		linkElement.setAttribute( 'download', exportFileDefaultName );
		linkElement.click();
	}
})( jQuery, PC.import, PC._us || window._ );