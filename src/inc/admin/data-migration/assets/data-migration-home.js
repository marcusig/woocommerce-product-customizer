/**
 * Delegated handlers for legacy blob delete/restore (configurator home / instructions).
 */
( function ( $ ) {
	'use strict';

	function postLegacyAction( action, $btn ) {
		return $.post( window.ajaxurl, {
			action: action,
			nonce: $btn.data( 'nonce' ),
			parent_id: $btn.data( 'parent-id' ),
			variation_id: $btn.data( 'variation-id' ) || 0,
		} );
	}

	$( document.body ).on( 'click', '.mkl-pc-delete-legacy-config', function ( e ) {
		e.preventDefault();
		var $btn = $( e.currentTarget );
		var PC_lang = window.PC_lang || {};
		if ( ! window.confirm( PC_lang.mkl_pc_delete_legacy_confirm || '' ) ) {
			return;
		}
		$btn.prop( 'disabled', true );
		postLegacyAction( 'mkl_pc_delete_legacy_configurator_blobs', $btn )
			.done( function ( response ) {
				if ( response && response.success ) {
					if ( window.PC && PC.app && PC.app.admin_data && response.data && response.data.snapshot ) {
						PC.app.admin_data.set( 'pc_storage', response.data.snapshot );
					}
					var $wrap = $btn.closest( '.mkl-pc-data-migration.migration-warning' );
					$btn.closest( '.mkl-pc-legacy-data-notice' ).remove();
					if ( $wrap.length && $wrap.find( '.notice' ).length === 0 ) {
						$wrap.remove();
					}
				} else {
					window.alert( PC_lang.mkl_pc_legacy_ajax_error || 'Error' );
					$btn.prop( 'disabled', false );
				}
			} )
			.fail( function () {
				window.alert( PC_lang.mkl_pc_legacy_ajax_error || 'Error' );
				$btn.prop( 'disabled', false );
			} );
	} );

	$( document.body ).on( 'click', '.mkl-pc-restore-legacy-config', function ( e ) {
		e.preventDefault();
		var $btn = $( e.currentTarget );
		var PC_lang = window.PC_lang || {};
		if ( ! window.confirm( PC_lang.mkl_pc_restore_legacy_confirm || '' ) ) {
			return;
		}
		$btn.prop( 'disabled', true );
		postLegacyAction( 'mkl_pc_restore_legacy_configurator_blobs', $btn )
			.done( function ( response ) {
				if ( response && response.success ) {
					window.location.reload();
				} else {
					var msg =
						response && response.data && response.data.message
							? response.data.message
							: PC_lang.mkl_pc_legacy_ajax_error || 'Error';
					window.alert( msg );
					$btn.prop( 'disabled', false );
				}
			} )
			.fail( function () {
				window.alert( PC_lang.mkl_pc_legacy_ajax_error || 'Error' );
				$btn.prop( 'disabled', false );
			} );
	} );
}( jQuery ) );
