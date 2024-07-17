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
		save_all: function( state, options ) {
			this.saving = 0;
			this.errors = [];
			if ( _.indexOf( _.values( this.is_modified ), true ) != -1 ) {

				if ( state ) {
					state.$save_button.addClass('disabled');
					state.$save_all_button.addClass('disabled');
					state.$toolbar.addClass('saving');
					state.$el.addClass('saving');
				}
				var count = 0;
				var total = _.filter( _.values( this.is_modified ), function( a ) { return a === true } ).length;
				$.each( this.is_modified, function( key, val ) {
					count++;
					if ( val == true ) {
						this.saving ++;
						this.save( key, this.get_collection( key ), {
							// success: 'successfuil'
							success: _.bind( this.saved_all, this, key, state, options ),
							error: _.bind( this.error_saving, this, key, state, options ),
							data: {
								saveCache: count === total
							}
						} );
					}

				}.bind( this ) );
			} else {
				if ( options && options.saved_all ) options.saved_all();
			}

			// if ( this.saving == 0 ) this.admin.close();
		},

		error_saving: function( key, state, a, error_message ) {
			this.errors.push( error_message );
			this.saving--;
			if ( this.saving == 0 ) {
				state.state_saved( 1 );
				console.log( key, this.errors, state, a, error_message );
				alert( this.errors.join( "/n" ) );
			}
		},
		saved_all: function( key, state, options ) {
			this.saving--;
			this.is_modified[ key ] = false;
			if ( options && options.saved_one ) options.saved_one( key );
			if ( this.saving == 0 ) {

				if ( state && state.state_saved ) state.state_saved();
				if ( options && options.saved_all ) options.saved_all();
				// _.delay(function() {
				// 	that.admin.close();
				// }, 1500);

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

			if (collection.length > 0) {

				if ( collection instanceof Array ) {
					options.data[what] = {};
					$.each( collection, function( index, value ){
						options.data[what][index] = ( value instanceof Backbone.Collection ) ? JSON.stringify( value ) : value;
					});
				} else if ( collection instanceof Backbone.Collection ) {
					options.data[what] = JSON.stringify( collection );
				}
				if ( 'content' == what ) {
					options.data.modified_choices = PC.app.modified_choices;
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

} ) ( jQuery, PC._us || window._ );