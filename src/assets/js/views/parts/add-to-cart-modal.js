/**
 * Add to cart modal view
 */
PC.fe.views.add_to_cart_modal = Backbone.View.extend({
	tagName: 'div',
	className: 'adding-to-cart--modal',
	template: wp.template( 'mkl-pc-configurator-add-to-cart--modal' ),
	initialize: function( options ) {
		this.render();
		$( document.body ).on( 'adding_to_cart', this.on_adding.bind( this ) );
		$( document.body ).on( 'added_to_cart', this.on_added.bind( this ) );
		$( document.body ).on( 'quote_request_sent', this.on_quote_request_sent.bind( this ) );
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
	 * Close modal
	 */
	close: function() {
		$( document.body ).removeClass( 'show-add-to-cart-modal' );
	},
	/**
	 * Show messages
	 */
	on_adding: function( e, btn, data ) {	
		$( document.body ).addClass( 'show-add-to-cart-modal' );
		if ( data?.quote_request ) {
			this.show_message( 'sending-request' );
		} else {
			this.show_message( 'adding' );
		}
	},
	on_added: function( event, fragments, cart_hash, button, response ) {
		this.show_message( 'added', response.messages );
	},
	on_quote_request_sent: function( e, response ) {
		this.show_message( 'sent-request', response?.messages );
	},
	on_added_with_redirection: function() {
		this.show_message( 'added-redirect' );
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
		this.$el.empty().append( wp.template( 'mkl-pc-atc-' + type )( { messages: messages || '' } ) );
	}
} )