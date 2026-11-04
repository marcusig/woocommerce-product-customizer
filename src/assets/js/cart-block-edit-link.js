/**
 * Cart block: "Edit configuration" link next to the quantity.
 *
 * The cart block has no slot inside a line item, so the link is added to `.wc-block-cart-item__quantity`
 * after React has rendered the row. The URL comes from the Store API (`extensions.mkl_pc`).
 *
 * - The link is appended as the last child: React leaves a node it does not know about alone,
 *   as long as none of its own nodes are moved.
 * - Rows are re-rendered (quantity change, coupon, etc.), so the links are checked again on every
 *   DOM change in the cart, and on every cart data change.
 * - The same link is also rendered by PHP in the item's details. CSS hides that one once this one is
 *   in place, so if this script does not run, the details link still shows.
 */
( function () {
	'use strict';

	if ( ! window.wp || ! wp.data || ! wp.data.select ) return;

	var NAMESPACE = 'mkl_pc';
	var CART_STORE = 'wc/store/cart';
	var LINK_CLASS = 'mkl-pc--edit-configuration';
	var ROW_KEY_CLASS = 'mkl-pc-cart-item--';
	var scheduled = false;

	function getEditData( extensions ) {
		var data = extensions && extensions[ NAMESPACE ];
		return data && data.edit_url ? data : null;
	}

	/**
	 * Older versions of the cart block do not print `data-cart-item-key` on the rows:
	 * add the key as a class, through the supported filter.
	 */
	if ( window.wc && wc.blocksCheckout && wc.blocksCheckout.registerCheckoutFilters ) {
		wc.blocksCheckout.registerCheckoutFilters( 'mkl-pc-edit-link', {
			cartItemClass: function ( value, extensions, args ) {
				var key = args && args.cartItem && args.cartItem.key;
				if ( ! key || ! getEditData( extensions ) ) return value;
				return ( value ? value + ' ' : '' ) + ROW_KEY_CLASS + key;
			},
		} );
	}

	function getCartItems() {
		var store;
		try {
			store = wp.data.select( CART_STORE );
		} catch ( e ) {
			return null;
		}
		if ( ! store || 'function' !== typeof store.getCartData ) return null;
		var cart = store.getCartData();
		return cart && Array.isArray( cart.items ) ? cart.items : null;
	}

	function getRowKey( row ) {
		var key = row.getAttribute( 'data-cart-item-key' );
		if ( key ) return key;
		for ( var i = 0; i < row.classList.length; i++ ) {
			if ( 0 === row.classList[ i ].indexOf( ROW_KEY_CLASS ) ) {
				return row.classList[ i ].substring( ROW_KEY_CLASS.length );
			}
		}
		return '';
	}

	function getOwnLink( container ) {
		for ( var i = 0; i < container.children.length; i++ ) {
			var child = container.children[ i ];
			if ( 'A' === child.tagName && child.classList.contains( LINK_CLASS ) ) return child;
		}
		return null;
	}

	function sync() {
		scheduled = false;
		var items = getCartItems();
		if ( ! items ) return;

		var byKey = {};
		items.forEach( function ( item ) {
			byKey[ item.key ] = getEditData( item.extensions );
		} );

		var rows = document.querySelectorAll( 'tr.wc-block-cart-items__row' );
		Array.prototype.forEach.call( rows, function ( row ) {
			var container = row.querySelector( '.wc-block-cart-item__quantity' );
			if ( ! container ) return;

			var data = byKey[ getRowKey( row ) ] || null;
			var link = getOwnLink( container );

			if ( ! data ) {
				if ( link ) link.parentNode.removeChild( link );
				return;
			}

			if ( ! link ) {
				link = document.createElement( 'a' );
				link.className = LINK_CLASS;
			}
			if ( link.getAttribute( 'href' ) !== data.edit_url ) link.setAttribute( 'href', data.edit_url );
			if ( link.textContent !== data.edit_label ) link.textContent = data.edit_label;

			// Keep it last: React may have appended one of its own nodes after it.
			if ( container.lastElementChild !== link ) container.appendChild( link );
		} );
	}

	function schedule() {
		if ( scheduled ) return;
		scheduled = true;
		window.requestAnimationFrame( sync );
	}

	function init() {
		var roots = document.querySelectorAll( '.wp-block-woocommerce-cart' );
		if ( ! roots.length ) roots = [ document.body ];
		var observer = new MutationObserver( schedule );
		Array.prototype.forEach.call( roots, function ( root ) {
			observer.observe( root, { childList: true, subtree: true } );
		} );
		wp.data.subscribe( schedule );
		schedule();
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
