var PC = PC || {};
PC.views = PC.views || {};
( function( _ ) {
	/**
	 * Dashicon classes per menu_id (24px via CSS). Add-ons can add keys; unknown ids fall back below.
	 */
	var MKL_PC_NAV_ICONS = {
		home: 'dashicons-admin-home',
		layers: 'dashicons-screenoptions',
		angles: 'dashicons-visibility',
		content: 'dashicons-list-view',
		conditional_placeholder: 'dashicons-randomize',
		import: 'dashicons-migrate',
		conditional: 'dashicons-randomize',
		fonts: 'dashicons-editor-textcolor',
		form_builder: 'dashicons-editor-table',
		'mkl-pc__bulk': 'dashicons-tickets-alt',
		extra_price: 'dashicons-tag',
	};

	function mkl_pc_nav_icon_class( menuId ) {
		if ( ! menuId ) {
			return 'dashicons-admin-generic';
		}
		if ( MKL_PC_NAV_ICONS[ menuId ] ) {
			return MKL_PC_NAV_ICONS[ menuId ];
		}
		if ( typeof wp !== 'undefined' && wp.hooks && typeof wp.hooks.applyFilters === 'function' ) {
			var filtered = wp.hooks.applyFilters( 'mkl_pc_admin_nav_icon', '', menuId );
			if ( filtered ) {
				return filtered;
			}
		}
		return 'dashicons-admin-generic';
	}

	PC.views.states = Backbone.View.extend({
		items: [],
		template: wp.template('mkl-pc-menu'),
		events: {
			'click .mkl-pc-admin-ui__sidebar-primary-save': 'on_sidebar_save',
			'click .mkl-pc-admin-ui__back-to-product': 'on_back_to_product',
		},
		initialize: function( params ) {
			this.app = params.parent;
			this.render();
		},
		render: function() {
			// Only mount the shell once. editor.refresh() calls render() again after
			// states load; appending here would duplicate the sidebar.
			if ( ! this.$( '.mkl-pc-admin-ui__sidebar' ).length ) {
				this.$el.append( this.template() );
			}
			this.populateSidebarContext();
			if ( this.app.states.length ) {
				this.$menu = this.$('.mkl-pc-admin-ui__nav').html('');
				this.create_menu();
			}
			return this;
		},
		populateSidebarContext: function() {
			var lang = ( typeof window.PC_lang === 'object' && window.PC_lang ) ? window.PC_lang : {};
			var name = ( typeof lang.editor_product_name === 'string' ) ? lang.editor_product_name : '';
			var url = ( typeof lang.editor_product_permalink === 'string' ) ? lang.editor_product_permalink : '';
			var back = ( typeof lang.editor_back_to_product === 'string' ) ? lang.editor_back_to_product : '';
			if ( name ) {
				this.$( '.mkl-pc-admin-ui__product-name' ).text( name );
			}
			if ( url ) {
				this.$( '.mkl-pc-admin-ui__product-name' ).attr( 'href', url );
			}
			this.$( '.mkl-pc-admin-ui__back-text' ).text( back || '' );
			if ( PC.app && PC.app.syncSidebarSaveButtonState ) {
				PC.app.syncSidebarSaveButtonState();
			}
		},
		getActiveStateView: function() {
			if ( ! this.items || ! this.items.length ) {
				return null;
			}
			for ( var i = 0; i < this.items.length; i++ ) {
				var it = this.items[ i ];
				if ( it && it.model && it.model.get( 'active' ) === true && it.state ) {
					return it.state;
				}
			}
			return null;
		},
		on_sidebar_save: function( e ) {
			e.preventDefault();
			if ( jQuery( e.currentTarget ).attr( 'aria-disabled' ) === 'true' ) {
				return;
			}
			var st = this.getActiveStateView();
			if ( st && st.save_all ) {
				st.save_all();
			}
		},
		on_back_to_product: function( e ) {
			e.preventDefault();
			if ( PC.app && PC.app.get_admin && PC.app.get_admin().close ) {
				PC.app.get_admin().close();
			}
		},
		reset_active: function(){

		},
		create_menu: function(  ) {
			var that = this;
			that.items = [];
			this.app.states.orderBy = 'order';
			this.app.states.sort();
			this.app.states.each(function(model, index) {
				var line = '';
				switch(model.get('type')) {
					case 'part': 
						line = new PC.views.menu_item( { model:model, collection: that.app.states, app: that.app, main_view:that } );
						break;
					case 'separator': 
						line = new PC.views.separator();
						break;
				}

				that.items[index] = line;
				that.$menu.append( line.$el );
			});

			var start_item = 0;
			that.items[start_item].$el.trigger('click'); 
		}
	});

	PC.views.menu_item = Backbone.View.extend({
		tagName: 'button',
		className: 'mkl-pc-admin-ui__nav-item',
		initialize: function(options) {
			this.options = options || {};

			if( this.options.collection ) this.collection = this.options.collection;
			this.render();

			this.listenTo( this.model, 'change:active', this.activate ); 
		},
		events: {
			'click': 'show_this_state'
		},

		activate: function(){
			if(this.model.get('active') === true) {
				this.$el.addClass('active');
				this.$el.attr( 'aria-selected', 'true' );
			} else {
				this.$el.removeClass('active');
				this.$el.attr( 'aria-selected', 'false' );
				if( this.state ) this.state.remove();
			}
		},

		show_this_state: function(event){ 
			event.preventDefault();
			// Checks if selected item is not active.
			if(this.model.get('active') === false) {

				this.collection.each(function(model) {
					model.set('active', false);
				});
				if( this.state ) this.state.remove(); 
				this.state = new PC.views.state({model: this.model, options: this.options});
				this.options.main_view.$el.append( this.state.$el );
				this.options.main_view.$menu.removeClass( 'visible' );
			}

		},
		render: function() {
			var menuId = this.model.get( 'menu_id' );
			var label = this.model.get( 'label' );
			var iconClass = mkl_pc_nav_icon_class( menuId );
			this.$el.attr( 'type', 'button' );
			this.$el.attr( 'role', 'tab' );
			this.$el.attr( 'aria-selected', this.model.get( 'active' ) === true ? 'true' : 'false' );
			this.$el.attr( 'data-menu-id', menuId );
			this.$el.attr( 'data-mkl-hint', label );
			this.$el.attr( 'aria-label', label );
			this.$el.addClass( 'mkl-pc-admin-ui__nav-item--' + String( menuId ).replace( /[^a-z0-9_-]/gi, '' ) );
			this.$el.html(
				'<span class="mkl-pc-admin-ui__nav-item-icon" aria-hidden="true"><span class="dashicons ' + iconClass + '"></span></span>' +
				'<span class="mkl-pc-admin-ui__nav-item-text">' + _.escape( label ) + '</span>' +
				'<span class="mkl-pc-admin-ui__nav-item-chevron" aria-hidden="true"></span>'
			);
			return this;
		}
	});

	PC.views.state = Backbone.View.extend({
		tagName: 'div',
		className: 'mkl-pc-admin-ui__state',
		events: {
			'click .pc-main-save': 'save_state', 
			'click .pc-main-save-all': 'save_all', 
			'click .mkl-pc-admin-ui__menu-toggle': 'show_mobile_menu',
		},
		initialize: function( args ){

			this.options = args.options || {};

			if ( State = PC.views[this.model.get( 'menu_id' )] ) {
				// mkl-pc-admin-ui__state //mkl-pc-frame-title
				// Main frame target: .mkl-pc-admin-ui__state
				if( this.state ) this.state.remove();
				// this.$el = this.options.app.$('.mkl-pc-admin-ui__state');
				// Empties the target
				this.$el.empty(); 
				// Get the Frame's title Template (contains Title + description)
				// this.title_template = wp.template('mkl-pc-frame-title'); 

				// Instantiates the main view for the current state
				this.state = new State( { app: this.options.app, model: this.model, main_view: this.options.main_view } );

				PC.app.state = this.state;

				this.collectionName = this.state.collectionName;
				this.col = this.state.col;
				
				this.model.set('active', true);
				this.render();

				return this;
			} else {
				throw ('There is no View called ' + 'PC.views.' + this.model.get('menu_id') );
			}

		} ,
		remove: function() {
			if ( this.state && typeof this.state.remove === 'function' ) {
				this.state.remove();
			}
			return Backbone.View.prototype.remove.call( this );
		},
		render: function() {
			this.$el.append( this.state.$el );

			var $sb = this.options.main_view.$el;
			this.state.$toolbar = this.$toolbar = $sb.find( '.mkl-pc-admin-ui__sidebar-footer' );
			this.menu = this.model.get( 'menu' );
			// Main Save lives in the left sidebar; keep legacy btn refs for save_state / save_all / PC.app.save_all
			this.state.$save_button = this.$save_button = $sb.find( '.mkl-pc-admin-ui__sidebar .pc-main-save' );
			this.state.$save_all_button = this.$save_all_button = $sb.find( '.mkl-pc-admin-ui__sidebar .pc-main-save-all' );

			return this;
		},

		save_state: function( event ) {
			if ( PC.app.is_modified[this.collectionName] != true ) {
				return false;
			}

			this.$toolbar.addClass('saving');
			if ( PC.app.syncSidebarSaveButtonState ) {
				PC.app.syncSidebarSaveButtonState();
			}

			PC.app.save( this.collectionName, this.col, {
				// success: 'successfuil'
				success: _.bind(this.state_saved, this),
				error: _.bind(this.error_saving, this),
			} );
			// this.layers.save();
		},

		state_saved: function( has_errors ) { 
			this.$toolbar.removeClass('saving'); 
			this.$el.removeClass('saving'); 
			if ( PC.app.syncSidebarSaveButtonState ) {
				PC.app.syncSidebarSaveButtonState();
			}
			// reset 'modified'
			if ( ! has_errors ) {
				PC.app.is_modified[this.collectionName] = false;
				if ( this.collectionName === 'layers' ) { PC.app.modified_layer_ids = {}; PC.app.deleted_layer_ids = []; }
				if ( this.collectionName === 'content' ) PC.app.modified_content_layer_ids = {};
			}
		},
		error_saving: function(r, s) {
			this.$toolbar.removeClass('saving'); 
			if ( PC.app.syncSidebarSaveButtonState ) {
				PC.app.syncSidebarSaveButtonState();
			}
			alert(r);
		},
		save_all: function() {
			PC.app.save_all( this );
		},

		show_mobile_menu: function( e ) {
			this.options.main_view.$menu.toggleClass( 'visible' );
		}
		// save_state: function() {
		// 	this.state.$el.trigger('save-state');
		// } 
	});

	PC.views.separator = Backbone.View.extend({
		tagName: 'div',
		className: 'separator mkl-pc-admin-ui__nav-separator',
		initialize: function() {
			this.render();
		},
		render: function() {
			return this;
		}
	})

	// PC.view.title = Backbone.View.extend({
	// 	template: 'mkl-pc-frame-title'
	// });
} ( PC._us || window._ ) );