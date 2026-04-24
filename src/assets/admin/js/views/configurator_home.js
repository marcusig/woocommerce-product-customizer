var PC = PC || {};
PC.views = PC.views || {};

(function($){

	PC.views.home = Backbone.View.extend({
		tagName: 'div',
		className: 'state home',
		template: wp.template('mkl-pc-home'),
		events: {
			'click .mkl-pc-delete-legacy-config': 'delete_legacy_config',
			'click .mkl-pc-restore-legacy-config': 'restore_legacy_config',
		},

		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.append( this.template() );
			return this.$el;
		},
		delete_legacy_config: function( e ) {
			e.preventDefault();
			var $btn = $( e.currentTarget );
			if ( ! window.confirm( PC_lang.mkl_pc_delete_legacy_confirm || '' ) ) {
				return;
			}
			$btn.prop( 'disabled', true );
			$.post( ajaxurl, {
				action: 'mkl_pc_delete_legacy_configurator_blobs',
				nonce: $btn.data( 'nonce' ),
				parent_id: $btn.data( 'parent-id' ),
				variation_id: $btn.data( 'variation-id' ) || 0,
			} ).done( function( response ) {
				if ( response && response.success ) {
					window.location.reload();
				} else {
					window.alert( PC_lang.mkl_pc_legacy_ajax_error || 'Error' );
					$btn.prop( 'disabled', false );
				}
			} ).fail( function() {
				window.alert( PC_lang.mkl_pc_legacy_ajax_error || 'Error' );
				$btn.prop( 'disabled', false );
			} );
		},
		restore_legacy_config: function( e ) {
			e.preventDefault();
			var $btn = $( e.currentTarget );
			$btn.prop( 'disabled', true );
			$.post( ajaxurl, {
				action: 'mkl_pc_restore_legacy_configurator_blobs',
				nonce: $btn.data( 'nonce' ),
				parent_id: $btn.data( 'parent-id' ),
				variation_id: $btn.data( 'variation-id' ) || 0,
			} ).done( function( response ) {
				if ( response && response.success ) {
					window.location.reload();
				} else {
					window.alert( PC_lang.mkl_pc_legacy_ajax_error || 'Error' );
					$btn.prop( 'disabled', false );
				}
			} ).fail( function() {
				window.alert( PC_lang.mkl_pc_legacy_ajax_error || 'Error' );
				$btn.prop( 'disabled', false );
			} );
		},
	});

	PC.views.conditional_placeholder = Backbone.View.extend({
		tagName: 'div',
		className: 'state conditional_placeholder',
		template: wp.template('mkl-pc-conditional-placeholder'), 
		events: {
			'click .hide-notice': 'hide_placeholder'
		},
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.append( this.template() );
			return this.$el;
		},
		hide_placeholder: function( e ) {
			e.preventDefault();
			
			wp.ajax.post( {
				action: 'mkl_pc_hide_addon_setting',
				setting: 'conditional_placeholder',
				security: PC_lang.user_preferences_nonce
			} ).done( function( response ) {
				console.log( response );
			} );
		}
	});

})(jQuery);