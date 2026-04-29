/**
 * Full-screen blocking overlay during chunked storage migration (save + finalize).
 */
( function ( $ ) {
	'use strict';

	var PC_lang = function () {
		return window.PC_lang || {};
	};

	var messages = {
		layers: function () {
			return PC_lang().mkl_pc_migration_layers || '';
		},
		content: function () {
			return PC_lang().mkl_pc_migration_content || '';
		},
		finalize: function () {
			return PC_lang().mkl_pc_migration_finalize || '';
		},
		other: function () {
			return PC_lang().mkl_pc_migration_other || '';
		},
		complete: function () {
			return PC_lang().mkl_pc_migration_complete || '';
		},
		note: function () {
			return PC_lang().mkl_pc_migration_legacy_note || '';
		},
		dismiss: function () {
			return PC_lang().mkl_pc_migration_dismiss || '';
		},
	};

	var bulkMessages = {
		layers: function () {
			return PC_lang().mkl_pc_bulk_save_layers || messages.layers();
		},
		content: function () {
			return PC_lang().mkl_pc_bulk_save_content || messages.content();
		},
		finalize: function () {
			return PC_lang().mkl_pc_bulk_save_finalize || messages.finalize();
		},
		other: function () {
			return PC_lang().mkl_pc_bulk_save_other || messages.other();
		},
		complete: function () {
			return PC_lang().mkl_pc_bulk_save_complete || messages.complete();
		},
		note: function () {
			return PC_lang().mkl_pc_bulk_save_note || '';
		},
		dismiss: function () {
			return PC_lang().mkl_pc_bulk_save_dismiss || messages.dismiss();
		},
	};

	function ensureDom() {
		if ( $( '.mkl-pc-migration-overlay' ).length ) {
			return $( '.mkl-pc-migration-overlay' );
		}
		var $el = $(
			'<div class="mkl-pc-migration-overlay" role="dialog" aria-modal="true" aria-labelledby="mkl-pc-migration-overlay-status">' +
				'<div class="mkl-pc-migration-overlay__panel">' +
					'<div class="mkl-pc-migration-overlay__spinner mkl-pc-spinner" aria-hidden="true"></div>' +
					'<p id="mkl-pc-migration-overlay-status" class="mkl-pc-migration-overlay__status"></p>' +
					'<p class="mkl-pc-migration-overlay__note"></p>' +
					'<button type="button" class="button button-primary mkl-pc-migration-overlay__dismiss"></button>' +
				'</div>' +
			'</div>'
		);
		$( document.body ).append( $el );
		$el.on( 'click', '.mkl-pc-migration-overlay__dismiss', function () {
			window.MKL_PC_DataMigrationOverlay.hide();
		} );
		return $el;
	}

	window.MKL_PC_DataMigrationOverlay = {
		active: false,
		_mode: 'migration',

		show: function ( phase, mode ) {
			this.active = true;
			this._mode = mode || 'migration';
			var $root = ensureDom();
			$root.removeClass( 'is-complete' ).addClass( 'is-visible' ).attr( 'aria-busy', 'true' );
			$root.find( '.mkl-pc-migration-overlay__note' ).empty().hide();
			$root.find( '.mkl-pc-migration-overlay__dismiss' ).hide();
			this.setPhase( phase || 'layers' );
		},

		setPhase: function ( phase ) {
			if ( ! this.active ) {
				return;
			}
			var $root = $( '.mkl-pc-migration-overlay' );
			if ( ! $root.length ) {
				return;
			}
			var m = this._mode === 'bulk_save' ? bulkMessages : messages;
			var $status = $root.find( '.mkl-pc-migration-overlay__status' );
			if ( phase === 'complete' ) {
				$root.addClass( 'is-complete' ).attr( 'aria-busy', 'false' );
				$status.text( m.complete() );
				var noteText = m.note();
				if ( noteText ) {
					$root.find( '.mkl-pc-migration-overlay__note' ).text( noteText ).show();
				} else {
					$root.find( '.mkl-pc-migration-overlay__note' ).empty().hide();
				}
				$root.find( '.mkl-pc-migration-overlay__dismiss' ).text( m.dismiss() ).show();
				return;
			}
			var line = '';
			if ( phase === 'layers' ) {
				line = m.layers();
			} else if ( phase === 'content' ) {
				line = m.content();
			} else if ( phase === 'finalize' ) {
				line = m.finalize();
			} else if ( phase === 'other' ) {
				line = m.other();
			}
			$status.text( line );
		},

		hide: function () {
			this.active = false;
			this._mode = 'migration';
			$( '.mkl-pc-migration-overlay' ).removeClass( 'is-visible is-complete' ).remove();
			if ( window.PC && PC.app ) {
				PC.app._chunk_storage_migration_ui = false;
				PC.app._migration_messaging_keys = null;
				PC.app._bulk_save_overlay = false;
			}
		},
	};
}( jQuery ) );
