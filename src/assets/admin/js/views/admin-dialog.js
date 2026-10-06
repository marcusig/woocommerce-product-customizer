var PC = PC || {};
PC.views = PC.views || {};

/**
 * Reusable lightweight admin dialog (tmpl-mkl-pc-admin-dialog).
 * Does not use the main configurator shell (mkl-modal / mkl-pc-admin-ui.pc-modal).
 *
 * Subclasses override renderDialogBody() to return HTML for .mkl-pc-admin-dialog__body.
 */
(function ( $, _ ) {
	'use strict';

	PC.views.admin_dialog = Backbone.View.extend( {
		tagName: 'div',
		className: 'mkl-pc-admin-dialog-mount',

		events: {
			'click [data-mkl-pc-dialog-dismiss]': 'close',
		},

		initialize: function ( options ) {
			this.dialogOptions = _.extend(
				{
					title: '',
					titleId: '',
					extraClass: '',
					dismissOnEscape: true,
				},
				options || {}
			);
			if ( ! this.dialogOptions.titleId ) {
				this.dialogOptions.titleId = 'mkl-pc-admin-dialog-title-' + this.cid;
			}
			this._onDocKeydown = this._onDocKeydown.bind( this );
			this.render();
		},

		render: function () {
			var data = {
				title: this.dialogOptions.title || '',
				titleId: this.dialogOptions.titleId,
				extraClass: this.dialogOptions.extraClass || '',
			};
			this.$el.html( wp.template( 'mkl-pc-admin-dialog' )( data ) );
			this.$body = this.$el.find( '.mkl-pc-admin-dialog__body' );
			var bodyHtml = typeof this.renderDialogBody === 'function' ? this.renderDialogBody() : '';
			if ( bodyHtml ) {
				this.$body.html( bodyHtml );
			}
			$( 'body' ).append( this.$el );
			$( 'body' ).addClass( 'pc-modal-opened' );
			$( document ).on( 'keydown.mklPcAdminDialog_' + this.cid, this._onDocKeydown );
			wp.hooks.doAction( 'PC.admin.admin_dialog.rendered', this );
			return this;
		},

		/**
		 * @return {string|undefined}
		 */
		renderDialogBody: function () {
			return '';
		},

		/**
		 * @param {jQuery.Event} [e]
		 * @return {void}
		 */
		close: function ( e ) {
			if ( e && e.preventDefault ) {
				e.preventDefault();
			}
			$( document ).off( 'keydown.mklPcAdminDialog_' + this.cid, this._onDocKeydown );
			$( 'body' ).removeClass( 'pc-modal-opened' );
			wp.hooks.doAction( 'PC.admin.admin_dialog.closed', this );
			this.remove();
		},

		_onDocKeydown: function ( e ) {
			if ( ! this.dialogOptions.dismissOnEscape ) {
				return;
			}
			if ( e.keyCode === 27 ) {
				e.preventDefault();
				e.stopPropagation();
				this.close();
			}
		},

		open: function () {
			this.$el.show();
			var $focus = this.$body
				.find( 'input, button, select, textarea, a[href]' )
				.filter( ':visible' )
				.first();
			if ( $focus.length ) {
				$focus.trigger( 'focus' );
			}
			wp.hooks.doAction( 'PC.admin.admin_dialog.opened', this );
			return this;
		},
	} );
})( jQuery, PC._us || window._ );
