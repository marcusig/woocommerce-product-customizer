!(function($){

	$( '.mkl-edit-license' ).on( 'click', function( e ){
		e.preventDefault();
		$(this).toggleClass( 'open' );
	})

	var themes = {
		init: function() {
			this.$input = $( 'input[name="mkl_pc__settings[mkl_pc__theme]"]' );
			this.selection = this.$input.val();
			$( '.theme_setting button.mkl-pc--change-theme' ).on( 'click', this.show_selector.bind( this ) );
		},
		show_selector: function() {
			if ( ! this.selector ) {
				this.selector = new this.selectorView();
				this.selector.$el.appendTo( 'body' );
			}
			this.selector.show();
		},
		selectorView: Backbone.View.extend({
			tagName: 'div',
			className: 'mkl-pc__theme-selector',
			template: wp.template( 'mkl-pc-themes' ),
			events: {
				'click button.cancel': 'hide',
				'click button.select-theme': 'validate_theme_selection',
			},
			initialize: function() {
				this.themes = new Backbone.Collection([
					{
						'name': 'the name',
						'description': 'The description',
						'img': 'illsd.png'
					}
					,{
						'name': 'the other name',
						'description': 'The asdescription',
						'img': 'illsd2.png'
					}
				]);
				console.log(this.themes);
				this.render();
			},
			render: function() {
				this.$el.html( this.template() );
				this.add_themes( this.themes );
			},
			add_themes: function( themes_list ) {
				themes_list.each( this.add_one, this );
			},
			add_one: function( item ) {
				console.log('addone', item);
				var th = new themes.themeView({model: item});
				th.$el.appendTo( this.$el.find( '.themes-list' ) );
			},
			show: function() {
				this.$el.show();
			},
			hide: function() {
				this.$el.hide();
			},
			validate_theme_selection: function() {
				console.log(this.themes.findWhere( 'selected', true ), 'validate_theme_selection');
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
			},
			render: function() {
				console.log(this.model);
				this.$el.html( this.template( this.model.attributes ) );
			},
			select_theme: function( event ) {
				console.log(this.model.collection, 'selecting theme');
				var current = this.model.collection.findWhere( 'selected', true );
				if ( current ) current.set( 'selected', false );
				this.model.set( 'selected', true );
			},
			set_selected: function() {
				this.$el.toggleClass( 'selected', this.model.get( 'selected' ) );
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
		}
	};

	$(document).ready(function() {
		settings.init();
		themes.init();
	});

})(jQuery);