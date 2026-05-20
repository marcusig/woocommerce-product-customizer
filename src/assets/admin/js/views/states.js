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
		objects3d: 'dashicons-format-gallery',
		settings_3D: 'dashicons-admin-settings',
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
			'click .mkl-pc-sidebar-focus__back': 'on_sidebar_focus_back',
			'click .pc-3d-section-tab': 'on_3d_section_tab',
			'click .mkl-pc-admin-ui__sidebar-mobile-scrim': 'on_sidebar_mobile_scrim_click',
		},
		initialize: function( params ) {
			this.app = params.parent;
			if ( PC.app ) {
				PC.app.states_view = this;
			}
			this.render();
		},
		render: function() {
			// Only mount the shell once. editor.refresh() calls render() again after
			// states load; appending here would duplicate the sidebar.
			if ( ! this.$( '.mkl-pc-admin-ui__sidebar' ).length ) {
				this.$el.append( this.template() );
			}
			if ( ! this.$( '.mkl-pc-admin-ui__sidebar-mobile-scrim' ).length ) {
				var lang = ( typeof window.PC_lang === 'object' && window.PC_lang ) ? window.PC_lang : {};
				var close_label = ( typeof lang.editor_close_sidebar_menu === 'string' )
					? lang.editor_close_sidebar_menu
					: 'Close menu';
				var escaped = _.escape( close_label );
				this.$el.prepend(
					'<button type="button" class="mkl-pc-admin-ui__sidebar-mobile-scrim" aria-label="' + escaped + '">' +
					'<span class="screen-reader-text">' + escaped + '</span></button>'
				);
			}
			this.populateSidebarContext();
			if ( this.app.states.length ) {
				this.$menu = this.$( '.mkl-pc-admin-ui__nav-wrap--primary > .mkl-pc-admin-ui__nav' ).html( '' );
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
			this.applyGlobalConfiguratorBanner();
			if ( PC.app && PC.app.syncSidebarSaveButtonState ) {
				PC.app.syncSidebarSaveButtonState();
			}
			if ( PC.app && PC.app.syncSidebarFocusChrome ) {
				PC.app.syncSidebarFocusChrome( this );
			}
		},
		/**
		 * Global configurator subtitle: link to CPT when editing a linked product; plain text when already on the CPT.
		 * Banner text: global configurator post title prepended to the "Global configurator" label.
		 */
		applyGlobalConfiguratorBanner: function() {
			var $link = this.$( '.mkl-pc-global-configurator--banner-link' );
			var $plain = this.$( '.mkl-pc-global-configurator--banner-plain' );
			if ( ! $link.length || ! $plain.length ) {
				return;
			}
			var lang = ( typeof window.PC_lang === 'object' && window.PC_lang ) ? window.PC_lang : {};
			var bannerLabel = ( typeof lang.global_configurator_banner_label === 'string' )
				? lang.global_configurator_banner_label
				: 'Global configurator';
			var admin = PC.app && PC.app.admin_data;
			if ( ! admin || admin.get( 'configurator_source' ) !== 'global' ) {
				$link.attr( 'hidden', true ).hide();
				$plain.attr( 'hidden', true ).hide();
				return;
			}
			var gc = admin.get( 'global_configurator' );
			if ( ! gc ) {
				$link.attr( 'hidden', true ).hide();
				$plain.attr( 'hidden', true ).hide();
				return;
			}
			var bannerText = ( gc.title && String( gc.title ).trim() !== '' )
				? ( String( gc.title ).trim() + '\u00a0\u2014\u00a0' + bannerLabel )
				: bannerLabel;
			$link.prop( 'title', bannerText );
			// $plain.text( bannerText );
			if ( gc.is_editing_global ) {
				$link.attr( 'hidden', true ).hide();
				$plain.removeAttr( 'hidden' ).show();
				return;
			}
			var editUrl = gc.edit_url && typeof gc.edit_url === 'string' ? gc.edit_url : '';
			if ( editUrl ) {
				$link.attr( 'href', editUrl );
				$link.removeAttr( 'hidden' ).show();
				$plain.attr( 'hidden', true ).hide();
			} else {
				$link.attr( 'hidden', true ).hide();
				$plain.removeAttr( 'hidden' ).show();
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
			if ( PC.app && PC.app.isGlobalLayerFocusActive && PC.app.isGlobalLayerFocusActive() && PC.app.global_layer_session_dirty ) {
				if ( PC.app.saveGlobalLayerFromSidebar ) {
					PC.app.saveGlobalLayerFromSidebar();
				}
				return;
			}
			var st = this.getActiveStateView();
			if ( st && st.save_all ) {
				st.save_all();
			}
		},
		on_sidebar_focus_back: function( e ) {
			e.preventDefault();
			var ctx = PC.app && PC.app.getSidebarFocusContext ? PC.app.getSidebarFocusContext() : null;
			if ( ! ctx ) {
				return;
			}
			if ( ctx.mode === 'settings_3d' ) {
				if ( PC.app.leaveSettings3dViaSidebarBack ) {
					PC.app.leaveSettings3dViaSidebarBack();
				}
				return;
			}
			if ( PC.app && PC.app.requestLeaveGlobalLayerFocus && ! PC.app.requestLeaveGlobalLayerFocus() ) {
				return;
			}
		},
		on_3d_section_tab: function( e ) {
			e.preventDefault();
			if ( PC.app && PC.app.state && typeof PC.app.state.on_section_tab_click === 'function' ) {
				PC.app.state.on_section_tab_click( e );
			}
		},
		on_back_to_product: function( e ) {
			e.preventDefault();
			if ( PC.app && PC.app.isSettings3dSidebarFocusActive && PC.app.isSettings3dSidebarFocusActive() ) {
				if ( PC.app.requestLeaveSettings3dFocus && ! PC.app.requestLeaveSettings3dFocus() ) {
					return;
				}
			}
			if ( PC.app && PC.app.isGlobalLayerFocusActive && PC.app.isGlobalLayerFocusActive() ) {
				if ( PC.app.requestLeaveGlobalLayerFocus && ! PC.app.requestLeaveGlobalLayerFocus() ) {
					return;
				}
			}
			if ( PC.app && PC.app.get_admin && PC.app.get_admin().close ) {
				PC.app.get_admin().close();
			}
		},
		/**
		 * Collapse the mobile navigation drawer (menu rail + sidebar chrome).
		 */
		close_mobile_sidebar: function() {
			if ( ! this.$menu || ! this.$menu.length ) {
				return;
			}
			var $sidebar = this.$( '.mkl-pc-admin-ui__sidebar' );
			if ( ! this.$menu.hasClass( 'visible' ) && ! $sidebar.hasClass( 'mkl-pc-admin-ui__sidebar--open' ) ) {
				return;
			}
			this.$menu.removeClass( 'visible' );
			$sidebar.removeClass( 'mkl-pc-admin-ui__sidebar--open' );
			this.$( '.mkl-pc-admin-ui__menu-toggle' ).attr( 'aria-expanded', 'false' );
		},
		on_sidebar_mobile_scrim_click: function( e ) {
			e.preventDefault();
			e.stopPropagation();
			this.close_mobile_sidebar();
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
				var target_menu_id = this.model.get( 'menu_id' );
				if ( PC.app && PC.app.isSettings3dSidebarFocusActive && PC.app.isSettings3dSidebarFocusActive() && target_menu_id !== 'settings_3D' ) {
					if ( PC.app.requestLeaveSettings3dFocus && ! PC.app.requestLeaveSettings3dFocus() ) {
						return;
					}
					if ( PC.app.exitSettings3dSidebarFocus ) {
						PC.app.exitSettings3dSidebarFocus( this.options.main_view );
					}
				}
				if ( PC.app && PC.app.isGlobalLayerFocusActive && PC.app.isGlobalLayerFocusActive() ) {
					if ( PC.app.requestLeaveGlobalLayerFocus && ! PC.app.requestLeaveGlobalLayerFocus() ) {
						return;
					}
				}

				if ( target_menu_id === 'settings_3D' && PC.app ) {
					var prev_active = this.collection.find( function( m ) {
						return m.get( 'active' ) === true;
					} );
					if ( prev_active ) {
						PC.app.sidebar_focus_return_menu_id = prev_active.get( 'menu_id' );
					} else if ( ! PC.app.sidebar_focus_return_menu_id ) {
						PC.app.sidebar_focus_return_menu_id = 'home';
					}
					if ( PC.app.enterSettings3dSidebarFocus ) {
						PC.app.enterSettings3dSidebarFocus( this.options.main_view );
					}
				}

				this.collection.each(function(model) {
					model.set('active', false);
				});
				if( this.state ) this.state.remove(); 
				this.state = new PC.views.state({model: this.model, options: this.options});
				this.options.main_view.$el.append( this.state.$el );
				this.options.main_view.close_mobile_sidebar();
			}

		},
		render: function() {
			var menuId = this.model.get( 'menu_id' );
			var label = this.model.get( 'label' );
			var iconClass = mkl_pc_nav_icon_class( menuId );
			var iconHtml = PC.get_icon( 'nav_' + menuId, { fallback_dashicon: iconClass } );
			this.$el.attr( 'type', 'button' );
			this.$el.attr( 'role', 'tab' );
			this.$el.attr( 'aria-selected', this.model.get( 'active' ) === true ? 'true' : 'false' );
			this.$el.attr( 'data-menu-id', menuId );
			this.$el.attr( 'data-mkl-hint', label );
			this.$el.attr( 'aria-label', label );
			this.$el.addClass( 'mkl-pc-admin-ui__nav-item--' + String( menuId ).replace( /[^a-z0-9_-]/gi, '' ) );
			this.$el.html(
				'<span class="mkl-pc-admin-ui__nav-item-icon" aria-hidden="true"><span class="pc-admin-icon">' + iconHtml + '</span></span>' +
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
			'click .custom-action': 'state_custom_action', 
			'click .pc-main-save-all': 'save_all', 
			'click .mkl-pc-admin-ui__menu-toggle': 'show_mobile_menu',
		},
		initialize: function( args ){

			this.options = args.options || {};

			if ( State = PC.views[this.model.get( 'menu_id' )] ) {
				if( this.state ) this.state.remove();
				this.$el.empty();

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
			var desc = this.model.get( 'description' );
			this.$el.append( wp.template( 'mkl-pc-frame-title' )( {
				title: this.model.get( 'title' ) || '',
				description: desc ? desc : '',
			} ) );
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
			var main_view = this.options.main_view;
			var $menu = main_view.$menu;
			var open_next = ! $menu.hasClass( 'visible' );
			if ( open_next ) {
				$menu.addClass( 'visible' );
				main_view.$( '.mkl-pc-admin-ui__sidebar' ).addClass( 'mkl-pc-admin-ui__sidebar--open' );
				if ( e && e.currentTarget ) {
					e.currentTarget.setAttribute( 'aria-expanded', 'true' );
				}
			} else {
				main_view.close_mobile_sidebar();
			}
		},
		// save_state: function() {
		// 	this.state.$el.trigger('save-state');
		// }

		state_custom_action: function( e ) {
			this.state.$el.trigger( 'custom-state-action', e.currentTarget );
		} 
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