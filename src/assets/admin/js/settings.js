!(function($){

	$( '.mkl-edit-license' ).on( 'click', function( e ){
		e.preventDefault();
		$(this).toggleClass( 'open' );
	})

	var Themes = {
		init: function() {
			this.$input = $( 'input[name="mkl_pc__settings[mkl_pc__theme]"]' );
			this.selection = this.$input.val();
			var themeData = JSON.parse($('script#mkl_pc_themes_data').text());

			if ( ! themeData ) return;

			this.data = new Backbone.Collection( themeData );
			this.selected_theme = new Backbone.Model( { theme_id: this.selection } );

			var settingView = new this.settingView( { el: $( '.theme_setting_view' ) } );

			// Set the value
			this.selected_theme.on( 'change:theme_id', function( m, value ) {
				Themes.$input.val( value );
			} );

			if ( this.selection ) {
				this.selected_model = this.data.get( this.selection );
				
				if ( this.selected_model ) this.selected_model.set( 'selected', true );
			}
		},
		show_selector: function() {
			if ( ! this.selector ) {
				this.selector = new this.selectorView( { target: this.$input } );
				this.selector.$el.appendTo( 'body' );
			}
			this.selector.show();
		},
		settingView: Backbone.View.extend({
			template: wp.template( 'mkl-pc-themes-setting-view' ),
			events: {
				'click button.mkl-pc--change-theme': 'open_selector',
				'click button.mkl-pc--reset-theme': 'reset_theme',
			},
			initialize: function() {
				this.listenTo( Themes.selected_theme, 'change', this.render ); 
				this.render( Themes.selected_theme );
			},
			render: function( model ) {
				var selection = Themes.data.get( model.get( 'theme_id' ) );
				if ( selection ) {
					this.$el.html( this.template( selection.attributes ) );
				} else {
					this.$el.html( this.template( {} ) );
				}
			},
			open_selector: function() {
				Themes.show_selector();
			},
			reset_theme: function() {
				Themes.selected_theme.set( 'theme_id', null );
				Themes.data.get( Themes.selection ).set( 'selected', false );
			}
		}),
		selectorView: Backbone.View.extend({
			tagName: 'div',
			className: 'mkl-pc__theme-selector',
			template: wp.template( 'mkl-pc-themes' ),
			events: {
				'click button.cancel': 'hide',
				'click button.select-theme': 'choose_theme',
			},
			initialize: function( options ) {
				this.options = options;
				this.listenTo( Themes.data, 'change:selected', this.selection_changed ); 
				this.render();
			},
			render: function() {
				this.$el.html( this.template() );
				this.add_themes( Themes.data );
			},
			add_themes: function( themes_list ) {
				themes_list.each( this.add_one, this );
			},
			add_one: function( item ) {
				var th = new Themes.themeView({model: item});
				th.$el.appendTo( this.$el.find( '.themes-list' ) );
			},
			show: function() {
				this.$el.show();
			},
			hide: function() {
				this.$el.hide();
			},
			choose_theme: function() {
				if ( ! this.current_selection ) return;
				Themes.selected_theme.set( 'theme_id', this.current_selection.id );
				this.hide();
			},
			selection_changed: function( model ) {
				if ( ! model.get( 'selected' ) ) return;
				this.current_selection = model;
				var th = new Themes.themeView( { model: model } );
				if ( this.selection_preview ) this.selection_preview.remove();
				this.selection_preview = th;
				th.$el.appendTo( this.$el.find( 'footer .selection' ) );
			}
		}),
		themeView: Backbone.View.extend({
			tagName: 'div',
			className: 'mkl-pc__theme',
			template: wp.template( 'mkl-pc-theme-item' ),
			events: {
				'click .trigger': 'select_theme'
			},
			initialize: function() {
				this.listenTo( this.model, 'change:selected', this.set_selected ); 
				this.render();
				this.set_selected();
			},
			render: function() {
				this.$el.html( this.template( this.model.attributes ) );
			},
			select_theme: function( event ) {
				var current = this.model.collection.findWhere( 'selected', true );
				if ( current ) current.set( 'selected', false );
				this.model.set( 'selected', true );
			},
			set_selected: function() {
				this.$el.toggleClass( 'selected', true === this.model.get( 'selected' ) );
			}

		}),
	};

	var settings = {
		init: function() {
			$( '.mkl-nav-tab-wrapper a' ).on( 'click', function( e ) {
				e.preventDefault();
				$( '.mkl-nav-tab-wrapper a' ).removeClass( 'nav-tab-active' );
				$( '.mkl-settings-content.active' ).removeClass( 'active' );
				$(this).addClass( 'nav-tab-active' );
				$( '.mkl-settings-content[data-content=' + $( this ).data( 'content' ) + ']' ).addClass( 'active' );
			});

			if ( $( '.mkl-nav-tab-wrapper a.nav-tab-active' ).length ) {
				$( '.mkl-nav-tab-wrapper a.nav-tab-active' ).trigger( 'click' );
			} else {
				$( '.mkl-nav-tab-wrapper a' ).first().trigger( 'click' );
			}

			$('.mkl-settings-purge-config-cache').on( 'click', function( e ) {
				var btn = $( this );
				btn.prop( 'disabled', 'disabled' );
				wp.ajax.post({
					action: 'mkl_pc_purge_config_cache',
					security: $( '#_wpnonce' ).val()
				}).done( function( response ) {
					btn.prop( 'disabled', false );
				} );
			} );

			this.init_stock_management();
		},
		init_stock_management: function() {
			if ( $( '#mkl_pc__settings-stock_link_type' ).length ) {
				$( '#mkl_pc__settings-stock_link_type' ).on( 'change', function( e ) {
					$( 'input[name="mkl_pc__settings[extra_price_overrides_product_price]"]' ).closest( 'tr' ).toggle( 'add_to_cart' == $( this ).val() );
				} );
	
				$( 'input[name="mkl_pc__settings[extra_price_overrides_product_price]"]' ).closest( 'tr' ).toggle( 'add_to_cart' == $( '#mkl_pc__settings-stock_link_type' ).val() );
			}
		}
	};

	$(document).ready(function() {
		settings.init();
		Themes.init();
	});

})(jQuery);