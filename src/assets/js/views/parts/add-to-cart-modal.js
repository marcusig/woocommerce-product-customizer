/**
 * Add to cart modal view
 */
PC.fe.views.add_to_cart_modal = Backbone.View.extend({
	tagName: 'div',
	className: 'adding-to-cart--modal',
	template: wp.template( 'mkl-pc-configurator-add-to-cart--modal' ),
	initialize: function( options ) {
		this.busy = false;
		this.return_focus = null;
		this.render();
		$( document.body ).on( 'adding_to_cart', this.on_adding.bind( this ) );
		$( document.body ).on( 'added_to_cart', this.on_added.bind( this ) );
		$( document.body ).on( 'added_to_cart_with_redirection', this.on_added_with_redirection.bind( this ) );
		$( document.body ).on( 'not_added_to_cart_with_error', this.on_not_added_to_cart.bind( this ) );
	},
	events: {
		'click button.continue-shopping': 'close',
	},
	/**
	 * Add the modal to the page
	 */
	render: function() {
		this.$el.empty().append( this.template() );
		if ( PC.fe.inline ) {
			this.$el.appendTo( $( 'body' ) );
		} else {
			this.$el.appendTo( PC.fe.modal.$main_window );
		}
	},
	/**
	 * @return {boolean}
	 */
	is_open: function() {
		return $( document.body ).hasClass( 'show-add-to-cart-modal' );
	},
	/**
	 * Show the modal, remembering where the focus goes back to when it closes
	 *
	 * @param {Element} [return_focus] Defaults to the focused element.
	 */
	open: function( return_focus ) {
		if ( ! this.is_open() ) {
			var target = return_focus || document.activeElement;
			this.return_focus = target && target !== document.body && ! $.contains( this.el, target ) ? target : null;
		}
		$( document.body ).addClass( 'show-add-to-cart-modal' );
	},
	/**
	 * Close modal
	 */
	close: function() {
		var was_open = this.is_open();
		$( document.body ).removeClass( 'show-add-to-cart-modal' );
		this.set_busy( false );
		if ( ! was_open ) return;

		var target = this.return_focus;
		this.return_focus = null;
		if ( target && document.body.contains( target ) && $( target ).is( ':visible' ) ) {
			PC.fe.a11y.focus_without_scroll( $( target ) );
		}
		this.trigger( 'close', this );
	},
	/**
	 * A busy modal (sending a quote request) does not close on Escape, as its result would not be seen
	 *
	 * @param {boolean} busy
	 */
	set_busy: function( busy ) {
		this.busy = !! busy;
		this.$el.attr( 'aria-busy', this.busy ? 'true' : null );
	},
	/**
	 * Keyboard while the modal is open, called by the configurator which listens on the document:
	 * Escape closes the modal and leaves the configurator open, Tab stays in the modal.
	 *
	 * @param {KeyboardEvent} event
	 */
	keydown: function( event ) {
		if ( 'Escape' === event.key ) {
			event.preventDefault();
			if ( ! this.busy ) this.close();
			return;
		}
		if ( 'Tab' !== event.key ) return;

		// The honeypot of the quote request form, and other inputs taken out of the tab order.
		var $focusable = PC.fe.a11y.filter_focusable( this.$( PC.fe.a11y.modal_focusable_selector ) ).not( '[tabindex="-1"]' );
		var active = document.activeElement;
		if ( ! $focusable.length ) {
			event.preventDefault();
			return;
		}
		var first = $focusable[0];
		var last = $focusable[ $focusable.length - 1 ];
		// Outside the modal, or on an element focused by script such as a title.
		var astray = ! $.contains( this.el, active ) || -1 === $focusable.index( active );
		// A radio group is one tab stop.
		var on_first = active === first || ( 'radio' === active.type && 'radio' === first.type && active.name === first.name );
		if ( event.shiftKey && ( astray || on_first ) ) {
			event.preventDefault();
			PC.fe.a11y.focus_without_scroll( $( last ) );
		} else if ( ! event.shiftKey && ( astray || active === last ) ) {
			event.preventDefault();
			PC.fe.a11y.focus_without_scroll( $( first ) );
		}
	},
	/**
	 * Show messages
	 */
	on_adding: function() {
		// Not busy: a failed request leaves the modal on this message, and Escape is the way out.
		this.open();
		this.show_message( 'adding' );
	},
	on_added: function( event, fragments, cart_hash, button, response ) {
		this.show_message( 'added', response.messages );
	},
	on_added_with_redirection: function( e, response ) {
		this.show_message( 'added-redirect', response.messages );
	},
	on_not_added_to_cart: function( e, response ) {
		this.show_message( 'not-added', response.messages );
	},
	/**
	 * Show the notice
	 * @param {string} type 
	 * @param {string} messages
	 */
	show_message: function( type, messages ) {
		this.set_busy( false );
		this.$el.empty().append( wp.template( 'mkl-pc-atc-' + type )( { messages: messages || '' } ) );
	},
	/**
	 * Open the modal on a given template, for flows other than the cart (the quote request).
	 *
	 * @param {string} template_id wp.template id, without the `tmpl-` prefix.
	 * @param {Object} data        Template data.
	 */
	show_template: function( template_id, data ) {
		this.open();
		this.set_busy( false );
		this.$el.empty().append( wp.template( template_id )( data || {} ) );
		// The first action takes the focus, so a keyboard user lands on the choices it offers.
		this.$( 'button, a.button' ).first().trigger( 'focus' );
	}
} )
