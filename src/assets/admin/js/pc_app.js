var PC = PC || {};
// Backbone.emulateHTTP = true;

Backbone.Model.prototype.toJSON = function() {
	var json = _.clone(this.attributes); 
	for(var attr in json) {
		if ((json[attr] instanceof Backbone.Model) || (json[attr] instanceof Backbone.Collection)) {
			json[attr] = json[attr].toJSON(); 
		}
	}
	return json;
};


!(function($){
	PC.actionParameter = 'pc_get_data'; 
	PC.setActionParameter = 'pc_set_data'; 
	PC.app = PC.app || {
		is_modified: {
			layers: false,
			angles: false,
			content: false,
		},
		state: null,
		init: function( options ) {
			PC.lang = PC_lang || {};
			if ( options.product_id === undefined) { 
				throw( { name: 'Error', message: 'product_id parameter is missing to start the configurator.' } );
				return false; 
			}

			var id = this.id = ( options.product_type == 'simple' ) ? options.product_id : options.parent_id;

			if ( !this.admin ) {

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
					return this.get_product().get('content');
					break;
				case 'layers':
				case 'angles':
				default :
					return this.admin[ key ];
					break;

			}
		},

		save_all: function( state ) {
			this.saving = 0;
			if ( _.indexOf( _.values( this.is_modified ), true ) != -1 ) {

				state.$save_button.addClass('disabled');
				state.$save_all_button.addClass('disabled');
				state.$toolbar.addClass('saving'); 
			}
			$.each( this.is_modified, function( key, val ) {
				if ( val == true ) {
					this.saving ++;
					this.save( key, this.get_collection( key ), {
						// success: 'successfuil'
						success: _.bind(this.saved_all, this, key, state),
						error: _.bind(this.error_saving, this, key, state)
					} );
				}

			}.bind( this ) );
			if ( this.saving == 0 ) this.admin.close();
		},

		error_saving: function( key, state, a ) {
			this.saving--;
		},
		saved_all: function( key, state ) {
			this.saving--;
			this.is_modified[ key ] = false;
			if ( this.saving == 0 ) {

				state.state_saved();
				// _.delay(function() {
				// 	that.admin.close();
				// }, 1500);

			}

		},
		save: function( what, collection, options ) {
			var save_id = this.id;
			if ( this.options.product_type == 'variation' && ( 'content' == what || 'conditions' == what  ) ) {
				save_id = this.options.product_id;
			}
			// If we do not have the necessary nonce, fail immeditately.
			if ( ! this.admin_data.get('nonces') || ! this.admin_data.get('nonces').update ) {
				console.log('nonce problem');
				return $.Deferred().rejectWith( this ).promise();
			}
			if ( ! this.is_modified[what] ) {
				console.log('not modified');
				return false;
			}

			options = options || {};
			options.context = this;
			// Set the action and ID.
			options.data = _.extend( options.data || {}, {
				action:  PC.setActionParameter,
				id:      save_id,
				nonce:   this.admin_data.get('nonces').update,
				data: what,
				// id: wp.media.model.settings.post.id
			});

			if ( save_id != this.id ) {
				options.data.parent_id = this.id;
			}

			if (collection.length > 0) {

				if ( collection instanceof Array ) {
					options.data[what] = {};
					$.each(collection, function(index, value){
						options.data[what][index] = ( value instanceof Backbone.Collection ) ? JSON.stringify(value) : value;
					});
				} else if ( collection instanceof Backbone.Collection ) {
					options.data[what] = JSON.stringify(collection);
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
		}




	};

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
			//.hide();
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

})(jQuery);