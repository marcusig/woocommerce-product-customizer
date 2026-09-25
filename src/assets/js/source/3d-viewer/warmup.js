/**
 * Start downloading a 3D product's viewer and models when the shopper reaches for it.
 *
 * A configurator behind a "Configure" button used to preload its models from
 * <head> on every product page view, so every visitor downloaded them, often
 * several MB, whether or not they ever opened it. Now the download starts on
 * the first sign of intent (pointer over the button, focus, touch), which still
 * lands well before the viewer asks for it, and straight away for an inline
 * configurator, which opens by itself.
 *
 * The model URLs are the product's eager ones, written by PHP into
 * window.mkl_pc_3d_warmup, keyed by product ID.
 */

const TRIGGER_SELECTOR = '.configure-product';
const INLINE_SELECTOR = '.mkl-configurator-inline';

/**
 * @param {Object}   deps
 * @param {Document} deps.doc
 * @param {function(): Object<string, string[]>} deps.get_urls_by_product
 * @param {function(): Promise} deps.import_viewer - Loads the viewer chunk.
 * @returns {{ warm: function(string|number): void, bind: function(): void }}
 */
export function create_warmup( { doc, get_urls_by_product, import_viewer } ) {
	const warmed = new Set();

	function urls_for( product_id ) {
		const by_product = get_urls_by_product() || {};
		if ( product_id != null && by_product[ String( product_id ) ] ) return by_product[ String( product_id ) ];
		// A trigger without a product ID (the product page's own button) can only mean
		// the product the page loaded the viewer for.
		const ids = Object.keys( by_product );
		return ids.length === 1 ? by_product[ ids[ 0 ] ] : [];
	}

	function preload( url ) {
		const existing = Array.prototype.some.call(
			doc.querySelectorAll( 'link[rel="preload"]' ),
			( link ) => link.href === url || link.getAttribute( 'href' ) === url
		);
		if ( existing ) return;
		const link = doc.createElement( 'link' );
		link.setAttribute( 'rel', 'preload' );
		// Same as the <head> preload in PHP: it has to match the request three's
		// FileLoader makes, or the model downloads twice.
		link.setAttribute( 'as', 'fetch' );
		link.setAttribute( 'crossorigin', 'anonymous' );
		link.setAttribute( 'type', /\.gltf(\?|#|$)/i.test( url ) ? 'model/gltf+json' : 'model/gltf-binary' );
		link.setAttribute( 'href', url );
		doc.head.appendChild( link );
	}

	function warm( product_id ) {
		const key = product_id == null || product_id === '' ? '*' : String( product_id );
		if ( warmed.has( key ) ) return;
		warmed.add( key );
		// Loading the chunk is harmless: evaluating it defines the viewer and touches no DOM.
		Promise.resolve().then( import_viewer ).catch( () => {} );
		urls_for( product_id ).forEach( preload );
	}

	function on_intent( event ) {
		const target = event.target && event.target.closest ? event.target.closest( TRIGGER_SELECTOR ) : null;
		if ( ! target || target.matches( INLINE_SELECTOR ) ) return;
		warm( target.getAttribute( 'data-product_id' ) );
	}

	function bind() {
		[ 'pointerover', 'focusin', 'touchstart' ].forEach( ( type ) => {
			doc.addEventListener( type, on_intent, { passive: true } );
		} );
		doc.querySelectorAll( INLINE_SELECTOR ).forEach( ( el ) => warm( el.getAttribute( 'data-product_id' ) ) );
	}

	return { warm, bind };
}
