/**
 * @jest-environment jsdom
 */

/**
 * The zone editor's geometry (views/zone-editor.js): a zone is { x, y, width, height, rotation }
 * in the reference image's pixels, (x, y) its top centre, turning around it. The dialog itself was
 * checked in the browser.
 */
const fs = require( 'fs' );
const path = require( 'path' );

const source = fs.readFileSync( path.join( __dirname, '../zone-editor.js' ), 'utf8' );

function load() {
	global._ = {
		extend: ( target, ...sources ) => Object.assign( target, ...sources ),
		clone: ( object ) => Object.assign( {}, object ),
		debounce: ( fn ) => fn,
		escape: ( value ) => String( value ),
		map: ( list, callback ) => list.map( callback ),
	};
	global.jQuery = () => ( {} );
	global.PC = {
		_us: global._,
		views: {
			admin_dialog: {
				prototype: { events: {} },
				extend: ( prototype, statics ) => {
					const View = function() {};
					View.prototype = prototype;
					return Object.assign( View, statics );
				},
			},
		},
	};
	// eslint-disable-next-line no-new-func
	new Function( source.replace( /^var PC = PC \|\| \{\};$/m, 'var PC = window.PC;' ) )();
	return global.PC.views.zone_editor;
}

afterEach( () => {
	delete global._;
	delete global.jQuery;
	delete global.PC;
} );

const close = ( actual, expected ) => {
	Object.keys( expected ).forEach( ( key ) => expect( actual[ key ] ).toBeCloseTo( expected[ key ], 6 ) );
};

describe( 'zone geometry', () => {
	test( 'a new zone is centred, half the image', () => {
		const Z = load();
		expect( Z.default_position( { width: 1000, height: 800 } ) ).toEqual( { x: 500, y: 200, width: 500, height: 400, rotation: 0 } );
	} );

	test( 'moving shifts the top centre', () => {
		const Z = load();
		expect( Z.move( { x: 100, y: 50, width: 40, height: 20, rotation: 30 }, 5, -3 ) ).toEqual( { x: 105, y: 47, width: 40, height: 20, rotation: 30 } );
	} );

	test( 'resizing an upright zone keeps the opposite edges', () => {
		const Z = load();
		const start = { x: 100, y: 50, width: 40, height: 20, rotation: 0 };
		// Right edge 10 further: left edge (80) stays, so the centre moves by 5.
		close( Z.resize( start, 'e', 10, 99 ), { x: 105, y: 50, width: 50, height: 20 } );
		// Top edge 5 higher: bottom (70) stays.
		close( Z.resize( start, 'n', 99, -5 ), { x: 100, y: 45, width: 40, height: 25 } );
		// Bottom-left corner.
		close( Z.resize( start, 'sw', -10, 10 ), { x: 95, y: 50, width: 50, height: 30 } );
	} );

	test( 'resizing a turned zone works in its own frame', () => {
		const Z = load();
		// Turned 90°: its own x axis points down the image, its own y axis to the left.
		const start = { x: 100, y: 50, width: 40, height: 20, rotation: 90 };
		// Dragging the right-hand ("e") edge 10 px down the image widens it by 10, and its top
		// centre moves 5 px down the image.
		close( Z.resize( start, 'e', 0, 10 ), { x: 100, y: 55, width: 50, height: 20 } );
		// A drag across the image moves the "e" edge nowhere.
		close( Z.resize( start, 'e', 10, 0 ), { x: 100, y: 50, width: 40, height: 20 } );
		// The "n" edge, dragged 5 px to the right of the image (its own -y), grows it by 5.
		close( Z.resize( start, 'n', 5, 0 ), { x: 105, y: 50, width: 40, height: 25 } );
	} );

	test( 'a zone never shrinks below 4 px', () => {
		const Z = load();
		const resized = Z.resize( { x: 100, y: 50, width: 40, height: 20, rotation: 0 }, 'e', -100, 0 );
		expect( resized.width ).toBe( 4 );
		close( resized, { x: 82 } );
	} );

	test( 'another image size keeps the zone in place, relatively', () => {
		const Z = load();
		expect( Z.rescale( { x: 100, y: 50, width: 40, height: 20, rotation: 10 }, { width: 1000, height: 500 }, { width: 2000, height: 1000 } ) )
			.toEqual( { x: 200, y: 100, width: 80, height: 40, rotation: 10 } );
	} );

	test( 'clamp: a minimum size, the rotation between -180 and 180', () => {
		const Z = load();
		expect( Z.clamp( { x: 0, y: 0, width: 1, height: 'x', rotation: 270 } ) ).toEqual( { x: 0, y: 0, width: 4, height: 4, rotation: -90 } );
		expect( Z.clamp( { x: 0, y: 0, width: 10, height: 10, rotation: -450 } ).rotation ).toBe( -90 );
		expect( Z.clamp( { x: 0, y: 0, width: 10, height: 10, rotation: 180 } ).rotation ).toBe( 180 );
	} );

	test( 'the box around a mask\'s opaque pixels, as a zone', () => {
		const Z = load();
		const width = 6;
		const height = 5;
		const data = new Uint8ClampedArray( width * height * 4 );
		const opaque = ( x, y ) => {
			data[ ( y * width + x ) * 4 + 3 ] = 255;
		};
		opaque( 1, 1 );
		opaque( 4, 3 );
		expect( Z.alpha_box( data, width, height ) ).toEqual( { x: 3, y: 1, width: 4, height: 3, rotation: 0 } );
		expect( Z.alpha_box( new Uint8ClampedArray( width * height * 4 ), width, height ) ).toBeNull();
	} );
} );

describe( 'removing the zone', () => {
	test( 'with a remove option, the footer button calls it and closes', () => {
		const View = load();
		expect( View.prototype.events()[ 'click .mkl-pc-zone-editor__remove' ] ).toBe( 'remove_zone' );
		const remove = jest.fn();
		const editor = { options: { remove }, close: jest.fn() };
		View.prototype.remove_zone.call( editor, { preventDefault() {} } );
		expect( remove ).toHaveBeenCalledTimes( 1 );
		expect( editor.close ).toHaveBeenCalledTimes( 1 );
	} );
} );
