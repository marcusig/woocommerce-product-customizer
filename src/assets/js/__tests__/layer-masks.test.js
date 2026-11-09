/**
 * @jest-environment jsdom
 */

/**
 * Layer masks in the <img> stack (views/parts/layer-masks.js): which mask applies,
 * the order mask-then-src, and what happens when a mask cannot load. The pixels
 * (CSS mask on screen, capture against the server merge) were checked in the
 * browser on product 613.
 */
const fs = require( 'fs' );
const path = require( 'path' );

const source = fs.readFileSync( path.join( __dirname, '../views/parts/layer-masks.js' ), 'utf8' );

const underscore = {
	isArray: Array.isArray,
	find: ( list, callback ) => ( list || [] ).find( callback ),
	each: ( list, callback ) => ( list || [] ).forEach( callback ),
};

/** Images that load or fail when the test says so. */
let images = [];
class FakeImage {
	constructor() {
		this.crossOrigin = null;
		images.push( this );
	}
	set src( value ) {
		this._src = value;
	}
	get src() {
		return this._src;
	}
}

function load( { active_angle = 1 } = {} ) {
	images = [];
	global._ = underscore;
	global.Image = FakeImage;
	global.PC = {
		fe: {
			angles: { findWhere: () => ( null === active_angle ? null : { id: active_angle } ) },
		},
	};
	jest.spyOn( console, 'log' ).mockImplementation( () => {} );
	( 0, eval )( source );
	return PC.fe.layer_masks;
}

function make_layer( masks ) {
	return { get: ( key ) => ( 'masks' === key ? masks : undefined ) };
}

function make_view() {
	return { el: document.createElement( 'img' ) };
}

const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

afterEach( () => {
	jest.restoreAllMocks();
	delete global._;
	delete global.Image;
	delete global.PC;
} );

describe( 'which mask', () => {
	test( 'the layer\'s entry for the angle, whatever the id\'s type; none without a url', () => {
		const masks = load();
		const layer = make_layer( [
			{ angleId: 1, image: { id: 5, url: 'front.png' } },
			{ angleId: '2', image: { id: 6, url: 'back.png' } },
			{ angleId: 3, image: { id: 0, url: '' } },
		] );
		expect( masks.get( layer, '1' ).url ).toBe( 'front.png' );
		expect( masks.get( layer, 2 ).url ).toBe( 'back.png' );
		expect( masks.get( layer, 3 ) ).toBeNull();
		expect( masks.get( layer, 4 ) ).toBeNull();
		expect( masks.get( make_layer( undefined ), 1 ) ).toBeNull();
		expect( masks.get( layer, undefined ) ).toBeNull();
	} );
} );

describe( 'setting the src', () => {
	test( 'without a mask, at once and unmasked', () => {
		const masks = load();
		const view = make_view();
		masks.set_src( view, make_layer( [] ), 'band.png' );
		expect( view.el.getAttribute( 'src' ) ).toBe( 'band.png' );
		expect( view.mask_image ).toBeNull();
		expect( images ).toEqual( [] );
	} );

	test( 'with a mask, only once the mask has loaded, CORS mode, mask first', async () => {
		const masks = load();
		const view = make_view();
		const layer = make_layer( [ { angleId: 1, image: { id: 5, url: 'https://shop.test/mask.png' } } ] );
		masks.set_src( view, layer, 'band.png' );
		expect( view.el.getAttribute( 'src' ) ).toBeNull();
		expect( images ).toHaveLength( 1 );
		expect( images[ 0 ].crossOrigin ).toBe( 'anonymous' );

		images[ 0 ].onload();
		await flush();
		expect( view.el.getAttribute( 'src' ) ).toBe( 'band.png' );
		expect( view.mask_image ).toBe( images[ 0 ] );
		expect( view.el.style.getPropertyValue( 'mask-image' ) ).toBe( 'url("https://shop.test/mask.png")' );
		expect( view.el.style.getPropertyValue( 'mask-size' ) ).toBe( 'contain' );
		expect( view.el.style.getPropertyValue( 'mask-position' ) ).toBe( 'center' );
		expect( view.el.style.getPropertyValue( 'mask-repeat' ) ).toBe( 'no-repeat' );

		// Loaded once per page.
		const other = make_view();
		masks.set_src( other, layer, 'band-2.png' );
		await flush();
		expect( images ).toHaveLength( 1 );
		expect( other.el.getAttribute( 'src' ) ).toBe( 'band-2.png' );
	} );

	test( 'a mask that cannot load leaves the image unmasked, and says so', async () => {
		const masks = load();
		const view = make_view();
		masks.set_src( view, make_layer( [ { angleId: 1, image: { url: 'missing.png' } } ] ), 'band.png' );
		images[ 0 ].onerror();
		await flush();
		expect( view.el.getAttribute( 'src' ) ).toBe( 'band.png' );
		expect( view.el.style.getPropertyValue( 'mask-image' ) ).toBe( '' );
		expect( view.mask_image ).toBeNull();
		expect( console.log ).toHaveBeenCalledWith( expect.stringContaining( 'missing.png' ) );
	} );

	test( 'an answer that comes too late changes nothing: asked again, removed or retired', async () => {
		const masks = load();
		const layer = make_layer( [ { angleId: 1, image: { url: 'slow.png' } } ] );

		const asked_again = make_view();
		masks.set_src( asked_again, layer, 'front.png' );
		masks.set_src( asked_again, make_layer( [] ), 'back.png' );

		const removed = make_view();
		masks.set_src( removed, layer, 'band.png' );
		removed.is_removed = true;

		const retired = make_view();
		masks.set_src( retired, layer, 'band.png' );
		retired.is_retired = true;

		images[ 0 ].onload();
		await flush();
		expect( asked_again.el.getAttribute( 'src' ) ).toBe( 'back.png' );
		expect( asked_again.el.style.getPropertyValue( 'mask-image' ) ).toBe( '' );
		expect( removed.el.getAttribute( 'src' ) ).toBeNull();
		expect( retired.el.getAttribute( 'src' ) ).toBeNull();
	} );

	test( 'the transparent placeholder is never waited for, and clears an earlier mask', async () => {
		const masks = load();
		const view = make_view();
		const layer = make_layer( [ { angleId: 1, image: { url: 'mask.png' } } ] );
		masks.set_src( view, layer, 'band.png' );
		images[ 0 ].onload();
		await flush();
		masks.set_src( view, layer, 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' );
		expect( view.el.getAttribute( 'src' ) ).toMatch( /^data:/ );
		expect( view.el.style.getPropertyValue( 'mask-image' ) ).toBe( '' );
		expect( view.mask_image ).toBeNull();
	} );
} );
