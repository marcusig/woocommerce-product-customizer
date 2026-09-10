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

	/**
	 * Turning a product into a global configurator reuses this overlay: the editor pushes its
	 * whole configuration to the new post in the same batches a save uses, so the phases line up
	 * one-for-one and only the wording differs.
	 */
	var toGlobalMessages = {
		layers: function () {
			return PC_lang().mkl_pc_global_convert_layers || messages.layers();
		},
		content: function () {
			return PC_lang().mkl_pc_global_convert_content || messages.content();
		},
		finalize: function () {
			return PC_lang().mkl_pc_global_convert_finalize || messages.finalize();
		},
		other: function () {
			return PC_lang().mkl_pc_global_convert_other || messages.other();
		},
		complete: function () {
			return PC_lang().mkl_pc_global_convert_complete || messages.complete();
		},
		note: function () {
			return PC_lang().mkl_pc_global_convert_note || '';
		},
		dismiss: function () {
			return PC_lang().mkl_pc_global_convert_dismiss || messages.dismiss();
		},
	};

	var modes = {
		migration: messages,
		bulk_save: bulkMessages,
		to_global: toGlobalMessages,
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
			var onDismiss = window.MKL_PC_DataMigrationOverlay._onDismiss;
			window.MKL_PC_DataMigrationOverlay.hide();
			if ( onDismiss ) {
				onDismiss();
			}
		} );
		return $el;
	}

	window.MKL_PC_DataMigrationOverlay = {
		active: false,
		_mode: 'migration',
		_onDismiss: null,

		/**
		 * Run a callback when the user dismisses the completion panel. Cleared on show/hide, so
		 * it only ever applies to the run that set it.
		 *
		 * @param {Function|null} callback
		 */
		setDismissHandler: function ( callback ) {
			this._onDismiss = callback || null;
		},

		show: function ( phase, mode ) {
			this.active = true;
			this._mode = mode || 'migration';
			this._onDismiss = null;
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
			var m = modes[ this._mode ] || messages;
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
			} else if ( phase === 'make_global' ) {
				line = PC_lang().mkl_pc_make_global_progress || 'Creating global layer…';
			} else if ( phase === 'save_global_layer' ) {
				line = PC_lang().mkl_pc_save_global_layer_progress || 'Saving global layer…';
			} else if ( phase === 'other' ) {
				line = m.other();
			}
			$status.text( line );
		},

		hide: function () {
			this.active = false;
			this._mode = 'migration';
			this._onDismiss = null;
			$( '.mkl-pc-migration-overlay' ).removeClass( 'is-visible is-complete' ).remove();
			if ( window.PC && PC.app ) {
				PC.app._chunk_storage_migration_ui = false;
				PC.app._migration_messaging_keys = null;
				PC.app._bulk_save_overlay = false;
			}
		},
	};
}( jQuery ) );
