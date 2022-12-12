var PC = window.PC || {};
PC.views = PC.views || {};
( function( $, Import, _ ) {

	/**
	 * Main import state view
	 */
	PC.views.migrate = Backbone.View.extend( {
		tagName: 'div',
		className: 'state layers-state', 
		template: wp.template('mkl-pc-migrate-data'),
		events: {
			'click button[data-action]': 'get_action',
		},
		initialize: function( options ) {
			Import.state = this;
			this.options = options;
			this.render();
		},
		render: function() {
			this.$el.append( this.template() );
			this.tool_container = this.$el.find( '.migration-action-content' );
		},
		get_action: function(e) {
			var action = $(e.currentTarget).data( 'action' );
			switch ( action ) {
				// case 'export-data':
				// 	this.export();
				// 	break;
				// case 'import-from-product':
				// 	this.show_tool( 'import_from_product' );
				// 	break;
				case 'migrate':
					Import.imported_data = {};
					Import.imported_data.collections = {};
					Import.imported_data.collections.layers = PC.toJSON( PC.app.get_collection( 'layers' ) );
					Import.imported_data.collections.angles = PC.toJSON( PC.app.get_collection( 'angles' ) );
					Import.imported_data.collections.content = PC.toJSON( PC.app.get_collection( 'content' ) );
					Import.imported_data.collections.conditions = PC.toJSON( PC.app.get_collection( 'conditions' ) || [] );
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
		},
	});

})( jQuery, PC.import, PC._us );