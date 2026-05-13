var PC = PC || {};
PC.views = PC.views || {};

(function($, _){

	PC.views.content = Backbone.View.extend({
		tagName: 'div',
		className: 'state content-state',
		template: wp.template( 'mkl-pc-content' ),
		events: {
			// 'save-state': 'save_content',
			'click .edit-choices': 'on_edit_choices',
			'click .save-choices': 'on_save_choices',
			'click .cancel-edit-choices': 'on_cancel_edit_choices',
			'click .mkl-pc-mobile-back-to-choices-list': 'on_mobile_back_to_choices_list',
			'click .mkl-pc-mobile-back-to-layers': 'on_mobile_back_to_layers',
		},
		collectionName: 'content',
		initialize: function( options ) {
			this.options = options || {};
			this.main_view = this.options.main_view;
			this.admin = PC.app.get_admin();
			this.product = PC.app.get_product();

			PC.selection.reset();

			if( !this.product.get('content') ) {
				this.product.set('content', new PC.content_list() );
			}

			this.col = this.product.get('content');

			this.render();
		},
		remove: function() {
			if ( this.mobile_stack_router && typeof this.mobile_stack_router.destroy === 'function' ) {
				this.mobile_stack_router.destroy();
				this.mobile_stack_router = null;
			}
			if ( this._on_window_resize_layer_mount ) {
				$( window ).off( 'resize.mklPcContentLayerMount', this._on_window_resize_layer_mount );
				this._on_window_resize_layer_mount = null;
			}
			if ( this.layers ) {
				this.layers.remove();
				this.layers = null;
			}
			if ( this.main_view && this.main_view.$el && this.main_view.$el.length ) {
				this.main_view.$el.off( 'input.mklPcContentSidebarFilter' );
				this.main_view.$el.removeClass( 'mkl-pc-admin-ui--content-mode' );
				this.main_view.$( '.mkl-pc-admin-ui__sidebar-layers-list' ).empty();
				this.main_view.$( '.mkl-pc-admin-ui__sidebar-layers' ).attr( 'hidden', 'hidden' ).attr( 'aria-hidden', 'true' );
			}
			this.$( '.mkl-pc-content-main-layers-list' ).empty();
			return Backbone.View.prototype.remove.call( this );
		},
		is_narrow_content_editor: function() {
			return typeof window.matchMedia === 'function' && window.matchMedia( '(max-width: 900px)' ).matches;
		},
		get_layer_list_mount: function() {
			if ( this.is_narrow_content_editor() && this.$list_main && this.$list_main.length ) {
				return this.$list_main;
			}
			return this.$list_sidebar && this.$list_sidebar.length ? this.$list_sidebar : this.$list_main;
		},
		sync_layer_list_mount_for_viewport: function() {
			if ( ! this.layers || ! this.layers.$el || ! this.layers.$el.length ) {
				return;
			}
			var target = this.get_layer_list_mount();
			if ( ! target || ! target.length ) {
				return;
			}
			if ( this.layers.$el.parent()[ 0 ] === target[ 0 ] ) {
				this.$list = target;
				return;
			}
			this.layers.$el.detach();
			this.$list = target;
			this.$list.append( this.layers.$el );
			this.applySidebarLayersFilter();
		},
		applySidebarLayersFilter: function() {
			if ( typeof PC.applyAdminListFilter !== 'function' || ! this.layers || ! this.layers.$el || ! this.layers.$el.length ) {
				return;
			}
			var $in_sidebar = this.main_view && this.main_view.$el ? this.main_view.$( '.mkl-pc-list-filter-input--sidebar-layers' ) : $();
			var $in_main = this.$el && this.$el.length ? this.$( '.mkl-pc-list-filter-input--content-main-layers' ) : $();
			var val = '';
			if ( this.is_narrow_content_editor() && $in_main.length ) {
				val = $in_main.val() || '';
			} else if ( $in_sidebar.length ) {
				val = $in_sidebar.val() || '';
			} else if ( $in_main.length ) {
				val = $in_main.val() || '';
			}
			PC.applyAdminListFilter( this.layers.$el, val, { mode: 'flat-li' } );
		},
		render: function() {
			if( !this.admin.layers || !this.admin.angles || this.admin.layers.length < 1 || this.admin.angles.length < 1) {
				var content = wp.template('mkl-pc-content-no-data');
				this.$el.append( content() );
			} else {
				if ( this.main_view && this.main_view.$el && this.main_view.$el.length ) {
					this.main_view.$el.addClass( 'mkl-pc-admin-ui--content-mode' );
					this.$list_sidebar = this.main_view.$( '.mkl-pc-admin-ui__sidebar-layers-list' );
					this.main_view.$( '.mkl-pc-admin-ui__sidebar-layers' ).removeAttr( 'hidden' ).attr( 'aria-hidden', 'false' );
					var selfSidebar = this;
					this.main_view.$el.off( 'input.mklPcContentSidebarFilter' ).on(
						'input.mklPcContentSidebarFilter',
						'.mkl-pc-list-filter-input--sidebar-layers, .mkl-pc-list-filter-input--content-main-layers',
						function( e ) {
							if ( typeof PC.applyAdminListFilter !== 'function' || ! selfSidebar.layers || ! selfSidebar.layers.$el ) {
								return;
							}
							var val = $( e.target ).val();
							if ( selfSidebar.main_view && selfSidebar.main_view.$el ) {
								selfSidebar.main_view.$( '.mkl-pc-list-filter-input--sidebar-layers' ).val( val );
							}
							if ( selfSidebar.$el && selfSidebar.$el.length ) {
								selfSidebar.$( '.mkl-pc-list-filter-input--content-main-layers' ).val( val );
							}
							PC.applyAdminListFilter( selfSidebar.layers.$el, val, { mode: 'flat-li' } );
						}
					);
				} else {
					this.$list_sidebar = $();
				}
				this.$el.append( this.template() );
				if ( PC.admin && PC.admin.mobile_stack_router && typeof PC.admin.mobile_stack_router.install_content_router === 'function' ) {
					this.mobile_stack_router = PC.admin.mobile_stack_router.install_content_router( this );
				}
				this.$choices = this.$( '.content-choices-list' );
				this.$form = this.$( '.content-choice' );
				this.$list_main = this.$( '.mkl-pc-content-main-layers-list' );
				this.$list = this.get_layer_list_mount();
				if ( this.$list && this.$list.length ) {
					this.active_layer = null;
					this.layers = new PC.views.content_layers( { list_el: this.$list, edit_el: this.$form, state: this } );
					this.$list.append( this.layers.el );
					var selfResize = this;
					this._on_window_resize_layer_mount = _.debounce( function() {
						selfResize.sync_layer_list_mount_for_viewport();
					}, 150 );
					$( window ).on( 'resize.mklPcContentLayerMount', this._on_window_resize_layer_mount );
					this.update_global_actions_visibility();
					this.applySidebarLayersFilter();
					var self = this;
					window.requestAnimationFrame( function() {
						self.focusSidebarLayerButton();
					} );
				}
			}
		},
		/** Move keyboard focus into the sidebar layer list (opened layer row, otherwise first layer). */
		focusSidebarLayerButton: function() {
			if ( ! this.$list || ! this.$list.length ) return;
			var $btn = this.$list.find( 'li.active button.layer' );
			if ( ! $btn.length ) {
				$btn = this.$list.find( 'button.layer' ).first();
			}
			if ( $btn.length ) {
				$btn.trigger( 'focus' );
			}
		},
		on_mobile_back_to_choices_list: function( e ) {
			if ( e ) {
				e.preventDefault();
			}
			if ( PC.app && PC.app.isGlobalLayerFocusActive && PC.app.isGlobalLayerFocusActive() ) {
				if ( PC.app.requestLeaveGlobalLayerFocus && ! PC.app.requestLeaveGlobalLayerFocus() ) {
					return;
				}
			}
			if ( this.active_layer && this.active_layer.clear_choice_detail_panel ) {
				this.active_layer.clear_choice_detail_panel();
			}
		},
		on_mobile_back_to_layers: function( e ) {
			if ( e ) {
				e.preventDefault();
			}
			if ( PC.app && PC.app.isGlobalLayerFocusActive && PC.app.isGlobalLayerFocusActive() ) {
				if ( PC.app.requestLeaveGlobalLayerFocus && ! PC.app.requestLeaveGlobalLayerFocus() ) {
					return;
				}
			}
			this.clear_content_layer_selection();
			this.sync_layer_list_mount_for_viewport();
			var self = this;
			window.requestAnimationFrame( function() {
				self.focusSidebarLayerButton();
			} );
		},
		clear_content_layer_selection: function() {
			if ( this.active_layer ) {
				this.active_layer.remove();
				this.active_layer = null;
			}
			if ( this.$choices && this.$choices.length ) {
				this.$choices.find( '.mkl-choice-list-inner' ).remove();
			}
			PC.selection.reset();
			if ( this.mobile_stack_router ) {
				this.mobile_stack_router.set_content_stack( PC.admin.CONTENT_STACK_LAYERS );
			} else {
				this.$el.removeClass( 'show-choices' );
			}
			if ( this.layers && this.layers.$el ) {
				this.layers.$el.children( 'li' ).removeClass( 'active' );
				this.layers.$el.find( 'button.layer' ).attr( 'aria-pressed', 'false' );
			}
			this.update_global_actions_visibility();
		},
		on_edit_choices: function( e ) {
			if ( e ) e.preventDefault();
			if ( this.active_layer && this.active_layer.on_edit_choices ) {
				if ( this.active_layer.model && this.active_layer.model.get( 'is_global' ) && this.active_layer.model.get( 'global_id' ) ) {
					if ( PC.app.clearGlobalSessionDirty ) {
						PC.app.clearGlobalSessionDirty();
					}
				}
				this.active_layer.on_edit_choices( e );
				// Store edit state in global collection
				if ( this.active_layer.model && this.active_layer.model.get( 'is_global' ) ) {
					var global_id = this.active_layer.model.get( 'global_id' );
					if ( global_id ) {
						PC.app.get_global_layers().set_editing_choices( global_id, true );
					}
				}
				this.update_global_actions_visibility();
			}
		},
		on_save_choices: function( e ) {
			if ( e ) e.preventDefault();
			if ( ! this.active_layer ) return;
			
			// Only handle global layers - local layers use PC.app.save()
			var is_global = this.active_layer.model && this.active_layer.model.get( 'is_global' );
			var global_id = this.active_layer.model && this.active_layer.model.get( 'global_id' );
			
			if ( ! is_global || ! global_id ) return;
			
			var self = this;

			var handled = false;
			try {
				wp.hooks.doAction( 'PC.admin.choices.save', this.active_layer.model, this.active_layer, function() {
					handled = true;
				} );
			} catch ( err ) {}

			if ( handled ) {
				this.active_layer.editing_choices = false;
				PC.app.get_global_layers().set_editing_choices( global_id, false );
				if ( this.active_layer.render ) {
					this.active_layer.render();
				}
				if ( this.active_layer.$el ) {
					this.active_layer.$el.trigger( 'choices-edit-mode-changed' );
				}
				wp.hooks.doAction( 'PC.admin.choices.editModeChanged', this.active_layer.model, this.active_layer );
				this.update_global_actions_visibility();
				return;
			}

			PC.app.setDataMigrationOverlay( 'save_global_layer' );
			if ( self.active_layer && self.active_layer.$el && self.active_layer.$el.length ) {
				self.active_layer.$el.addClass( 'is-saving-global-choices' );
			}

			// Save using global_layers collection
			var xhr = PC.app.get_global_layers().save_global_layer( global_id, null, PC.app.state.active_layer.col.toJSON(), {
				success: function( model, response ) {
					// Save successful
					self.active_layer.editing_choices = false;
					PC.app.get_global_layers().set_editing_choices( global_id, false );
					if ( PC.app.clearDirtyStateForLayer ) {
						PC.app.clearDirtyStateForLayer( self.active_layer.model );
					}
					if ( PC.app.clearGlobalSessionDirty ) {
						PC.app.clearGlobalSessionDirty();
					}
					if ( self.active_layer.render ) {
						self.active_layer.render();
					}
					// Trigger event for choiceDetails views to update lock state
					if ( self.active_layer.$el ) {
						self.active_layer.$el.trigger( 'choices-edit-mode-changed' );
					}
					wp.hooks.doAction( 'PC.admin.choices.editModeChanged', self.active_layer.model, self.active_layer );
					self.update_global_actions_visibility();
				},
				error: function( model, error ) {
					alert( 'Error saving choices: ' + PC.app.formatLayerAjaxErrorMessage( error ) );
					console.error( 'Save choices error response:', error );
				}
			} );

			var finishChoicesSaveUi = function() {
				PC.app.setDataMigrationOverlay();
				if ( self.active_layer && self.active_layer.$el && self.active_layer.$el.length ) {
					self.active_layer.$el.removeClass( 'is-saving-global-choices' );
				}
			};
			PC.app.afterJqXHR( xhr, finishChoicesSaveUi );
			return xhr;
		},
		on_cancel_edit_choices: function( e ) {
			if ( e ) e.preventDefault();
			if ( this.active_layer && this.active_layer.on_cancel_edit_choices ) {
				this.active_layer.on_cancel_edit_choices( e );
				// Clear edit state after canceling
				if ( this.active_layer.model && this.active_layer.model.get( 'is_global' ) ) {
					var global_id = this.active_layer.model.get( 'global_id' );
					if ( global_id ) {
						PC.app.get_global_layers().set_editing_choices( global_id, false );
					}
				}
				// Event is triggered in on_cancel_edit_choices, no need to trigger again here
				this.update_global_actions_visibility();
			}
		},
		update_global_actions_visibility: function() {
			// CSS handles visibility via .is-global-layer and .is-global-locked classes
			// We just need to ensure the state classes are set correctly
			if ( ! this.$el ) return;
			var is_global = this.active_layer && this.active_layer.model && this.active_layer.model.get( 'is_global' );
			// Get edit state from global collection if layer is global
			var is_editing = false;
			if ( is_global && this.active_layer.model.get( 'global_id' ) ) {
				is_editing = PC.app.get_global_layers().is_editing_choices( this.active_layer.model.get( 'global_id' ) );
			} else {
				is_editing = this.active_layer && this.active_layer.editing_choices;
			}
			
			// Set is-global-layer class based on whether active layer is global
			this.$el.toggleClass( 'is-global-layer', !! is_global );
			// Set is-global-locked when global layer is NOT in edit mode
			this.$el.toggleClass( 'is-global-locked', !! ( is_global && ! is_editing ) );
		},
		get_col: function() {
			return this.col;
		},

		
	});

	PC.views.content_layers = Backbone.View.extend({

		tagName: 'ul',
		className: 'layers',
		initialize: function( options ) {
			this.options = options || {}; 
			this.product = PC.app.get_product(); 
			
			this.render(); 
			return this; 
		},
		render: function() {
			this.$el.empty(); 
			PC.app.admin.layers.each( this.add_one, this );
			if ( this.options.state && this.options.state.applySidebarLayersFilter ) {
				this.options.state.applySidebarLayersFilter();
			}
		},

		add_one: function( model ) {
			if ( 'group' == model.get( 'type' ) || 'summary' == model.get( 'type' ) ) return;

			var options = _.defaults( this.options );
			var content = this.product.get('content');
			options.model = model;
			var layer = new PC.views.content_layer( options );
			this.$el.append( layer.el );
		}
	});

	PC.views.content_layer = Backbone.View.extend({
		tagName: 'li',
		template: wp.template('mkl-pc-content-layer'),
		events: {
			'click button.layer' : 'toggleLayer',
		}, 
		initialize: function( options ) {
			this.options = options || {}; 
			if ( !this.options.state )
				return false;

			this.product = PC.app.get_product(); 
			this.state = this.options.state;
			// get previously saved choices
			var product_choices = this.product.get('content'); 

			if ( ! product_choices.get( this.model.id ) ) {
				// product_choices.add({layerId: this.model.id, choices: new PC.choices( [], { layer: PC.app.get_product( this.model.id ) } ) });
				product_choices.add({layerId: this.model.id, choices: new PC.choices( [], { layer: PC.app.admin.layers.get( this.model.id ) } ) });
			}

			this.choices = product_choices.get( this.model.id ).get( 'choices' );
			this.listenTo( this.choices, 'add', this.udpate_number );
			this.listenTo( this.choices, 'remove', this.udpate_number );
			this.render();
		},
		render: function() {
			var n_choices = this.choices.length;
			var data = _.defaults(this.model.attributes);
			data.choices_number = n_choices;
			this.$el.empty();
			this.$el.append( this.template( data ) );
			if ( this.model.get( 'active' ) ) {
				this.$( 'button.layer' ).trigger( 'click' );
			}
		},
		udpate_number: function() {
			this.$( '.number-of-choices' ).text( this.choices.length );
		},
		toggleLayer: function(e) {
			e.preventDefault();
			if ( PC.app && PC.app.isGlobalLayerFocusActive && PC.app.isGlobalLayerFocusActive() ) {
				var ctx = PC.app.getGlobalLayerFocusContext();
				if ( ctx && ctx.layerModel && this.model !== ctx.layerModel ) {
					if ( ! PC.app.requestLeaveGlobalLayerFocus() ) {
						return;
					}
				}
			}
			if ( this.state.layers && this.state.layers.$el ) {
				this.state.layers.$el.children( 'li' ).removeClass( 'active' );
				this.state.layers.$el.find( 'button.layer' ).attr( 'aria-pressed', 'false' );
			}
			// Remove existing active layer - both the view and its DOM element
			if ( this.state.active_layer ) {
				// Remove the DOM element explicitly
				if ( this.state.active_layer.$el && this.state.active_layer.$el.parent().length ) {
					this.state.active_layer.$el.remove();
				}
				// Remove the Backbone view
				this.state.active_layer.remove();
			}
			// Also clean up any remaining mkl-choice-list-inner elements
			this.state.$choices.find('.mkl-choice-list-inner').remove();
			// Reset the selection collection, to prevent cross-layer issues
			PC.selection.reset();
			// Setup the new view
			var choices_view = new PC.views.choices({ model: this.model, state: this.state });
			// Restore edit state from global collection if this layer is global
			var global_id = null;
			var is_editing = false;
			if ( this.model.get( 'is_global' ) && this.model.get( 'global_id' ) ) {
				global_id = this.model.get( 'global_id' );
				is_editing = PC.app.get_global_layers().is_editing_choices( global_id );
				choices_view.editing_choices = is_editing;
			}
			this.state.active_layer = choices_view;
			this.state.$choices.append( choices_view.$el );
			// Re-render after appending to ensure edit state is reflected (render syncs from global collection)
			if ( this.model.get( 'is_global' ) && global_id ) {
				choices_view.render();
			}
			if ( this.state.mobile_stack_router ) {
				this.state.mobile_stack_router.set_content_stack( PC.admin.CONTENT_STACK_CHOICES );
			} else {
				this.state.$el.addClass( 'show-choices' );
			}
			this.$el.addClass( 'active' );
			this.$( 'button.layer' ).attr( 'aria-pressed', 'true' );
			// Update button visibility
			this.state.update_global_actions_visibility();

			// Refresh choices from server/source when opening a layer ONLY if NOT in edit mode
			// This prevents losing unsaved changes when navigating between tabs
			if ( this.state.active_layer && this.state.active_layer.refresh_from_server && this.model.get( 'is_global' ) && global_id ) {
				// Only refresh if NOT in edit mode (to preserve unsaved changes)
				if ( ! is_editing ) {
					this.state.active_layer.refresh_from_server().done( function() {
						// After refresh, ensure edit state is still properly set (should be false)
						if ( this.state.active_layer ) {
							this.state.active_layer.render();
							this.state.update_global_actions_visibility();
						}
					}.bind( this ) );
				}
			}
		}
	});



})(jQuery, PC._us || window._ );