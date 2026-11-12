/**
 * @jest-environment jsdom
 */

/**
 * Solid-colour choices (views/parts/choice-color.js): which choices draw their colour on
 * which view. See docs/solid-colour-choices-spec.md.
 */
const fs = require( 'fs' );
const path = require( 'path' );

const source = fs.readFileSync( path.join( __dirname, '../views/parts/choice-color.js' ), 'utf8' );
const masks_source = fs.readFileSync( path.join( __dirname, '../views/parts/layer-masks.js' ), 'utf8' );

const MASK = { id: 68, url: 'https://example.test/mask-front.png', dimensions: { width: 1200, height: 900 } };

function model( attributes ) {
	return { get: ( key ) => attributes[ key ] };
}

/** A collection of models keyed by `id`, like Backbone's. */
function collection( items ) {
	return {
		get: ( id ) => items.find( ( item ) => String( item.id ) === String( id ) ) || undefined,
		find: ( callback ) => items.find( callback ),
		findWhere: ( props ) => items.find( ( item ) => Object.keys( props ).every( ( key ) => item.get( key ) === props[ key ] ) ),
		first: () => items[ 0 ],
	};
}

function make_layer( attributes = {} ) {
	return model( Object.assign( {
		id: 3,
		type: 'simple',
		draw_choice_color: true,
		masks: [ { angleId: 1, image: MASK } ],
	}, attributes ) );
}

function make_choice( attributes = {}, images = [] ) {
	const pictures = images.map( ( image ) => Object.assign( model( { angleId: image.angleId, image: image.image } ), { id: image.angleId } ) );
	return model( Object.assign( { layerId: 3, color: '#1E90FF', images: collection( pictures ) }, attributes ) );
}

function load( layer, { active = 1 } = {} ) {
	const angles = [ 1, 2 ].map( ( id ) => Object.assign( model( { active: id === active } ), { id } ) );
	global._ = {
		isArray: Array.isArray,
		find: ( list, callback ) => ( list || [] ).find( callback ),
		each: ( list, callback ) => ( list || [] ).forEach( callback ),
	};
	global.PC = {
		fe: {
			angles: collection( angles ),
			layers: collection( layer ? [ Object.assign( layer, { id: layer.get( 'id' ) } ) ] : [] ),
		},
	};
	( 0, eval )( masks_source );
	( 0, eval )( source );
	return PC.fe.choice_color;
}

describe( 'normalize', () => {
	const helper = load( make_layer() );

	test.each( [
		[ '#1E90FF', '#1e90ff' ],
		[ ' #1e90ff ', '#1e90ff' ],
		[ '#19f', '#1199ff' ],
		[ '#1e90ff80', '' ],
		[ 'red', '' ],
		[ 'rgb(30, 144, 255)', '' ],
		[ '1e90ff', '' ],
		[ '', '' ],
		[ null, '' ],
		[ undefined, '' ],
	] )( '%p -> %p', ( value, expected ) => {
		expect( helper.normalize( value ) ).toBe( expected );
	} );
} );

describe( 'fill', () => {
	test( 'a choice without an image fills the mask with its colour, at the mask size', () => {
		const helper = load( make_layer() );
		expect( helper.fill( make_choice(), 1 ) ).toEqual( { color: '#1e90ff', mask: MASK, width: 1200, height: 900 } );
	} );

	test( 'the active view by default', () => {
		const helper = load( make_layer(), { active: 1 } );
		expect( helper.fill( make_choice() ) ).not.toBeNull();
		const on_back = load( make_layer(), { active: 2 } );
		expect( on_back.fill( make_choice() ) ).toBeNull();
	} );

	test( 'nothing when the layer does not draw choice colours', () => {
		expect( load( make_layer( { draw_choice_color: false } ) ).fill( make_choice(), 1 ) ).toBeNull();
		expect( load( make_layer( { draw_choice_color: undefined } ) ).fill( make_choice(), 1 ) ).toBeNull();
	} );

	test( 'nothing on a view without a mask', () => {
		expect( load( make_layer() ).fill( make_choice(), 2 ) ).toBeNull();
	} );

	test( 'nothing when the mask has no size', () => {
		const layer = make_layer( { masks: [ { angleId: 1, image: { id: 68, url: MASK.url } } ] } );
		expect( load( layer ).fill( make_choice(), 1 ) ).toBeNull();
	} );

	test( 'an image on the view wins; another view still draws the colour', () => {
		const layer = make_layer( { masks: [ { angleId: 1, image: MASK }, { angleId: 2, image: MASK } ] } );
		const choice = make_choice( {}, [ { angleId: 1, image: { id: 5, url: 'https://example.test/fabric.png' } } ] );
		const helper = load( layer );
		expect( helper.fill( choice, 1 ) ).toBeNull();
		expect( helper.fill( choice, 2 ) ).not.toBeNull();
	} );

	test( 'an empty image entry does not count as an image', () => {
		const choice = make_choice( {}, [ { angleId: 1, image: { id: '', url: '' } } ] );
		expect( load( make_layer() ).fill( choice, 1 ) ).not.toBeNull();
	} );

	test( 'nothing for a colour that is not a hex code', () => {
		expect( load( make_layer() ).fill( make_choice( { color: 'red' } ), 1 ) ).toBeNull();
		expect( load( make_layer() ).fill( make_choice( { color: '' } ), 1 ) ).toBeNull();
	} );

	test( 'nothing for groups, layers without choices and other layer types', () => {
		expect( load( make_layer() ).fill( make_choice( { is_group: true } ), 1 ) ).toBeNull();
		expect( load( make_layer( { not_a_choice: true } ) ).fill( make_choice(), 1 ) ).toBeNull();
		expect( load( make_layer( { type: 'group' } ) ).fill( make_choice(), 1 ) ).toBeNull();
		expect( load( make_layer( { type: 'multiple' } ) ).fill( make_choice(), 1 ) ).not.toBeNull();
	} );

	test( 'nothing when the layer is unknown', () => {
		expect( load( null ).fill( make_choice(), 1 ) ).toBeNull();
	} );
} );

describe( 'has_fill', () => {
	test( 'true when any view draws the colour', () => {
		expect( load( make_layer() ).has_fill( make_choice() ) ).toBe( true );
	} );

	test( 'false when every view has an image or no mask', () => {
		const choice = make_choice( {}, [ { angleId: 1, image: { id: 5, url: 'https://example.test/fabric.png' } } ] );
		expect( load( make_layer() ).has_fill( choice ) ).toBe( false );
	} );
} );

describe( 'admin hint (assets/admin/js/views/choice-color.js)', () => {
	function load_admin() {
		const admin_source = fs.readFileSync( path.join( __dirname, '../../admin/js/views/choice-color.js' ), 'utf8' );
		global.PC = {};
		global.window.PC_lang = {};
		global.wp = { hooks: { addAction: () => {} } };
		global.jQuery = () => {};
		( 0, eval )( admin_source );
		return PC.views.choice_color_hint;
	}

	test( 'normalizes exactly like the viewers', () => {
		const admin = load_admin();
		const viewers = load( make_layer() );
		[ '#1E90FF', '#19f', ' #abc ', '#1e90ff80', 'red', '', null, '#12', '#gggggg' ].forEach( ( value ) => {
			expect( admin.normalize( value ) ).toBe( viewers.normalize( value ) );
		} );
	} );

	test( 'messages: nothing when the layer does not draw colours', () => {
		expect( load_admin().messages( false, 'red' ) ).toEqual( { warning: '', hint: '' } );
	} );

	test( 'messages: a warning only for a value that cannot be drawn', () => {
		const admin = load_admin();
		expect( admin.messages( true, 'red' ).warning ).not.toBe( '' );
		expect( admin.messages( true, '#19f' ).warning ).toBe( '' );
		expect( admin.messages( true, '' ).warning ).toBe( '' );
		expect( admin.messages( true, '#19f' ).hint ).not.toBe( '' );
	} );
} );

describe( 'saved_image', () => {
	/** A choice whose get_image() answers like the model's, for the view asked. */
	function with_get_image( choice, ids ) {
		choice.get_image = ( image, what, angle_id ) => ( 'id' === what ? ids[ angle_id ] || '' : '' );
		return choice;
	}

	test( 'the image id when the choice has an image on the view', () => {
		const choice = with_get_image( make_choice( {}, [ { angleId: 1, image: { id: 5, url: 'https://example.test/fabric.png' } } ] ), { 1: 5 } );
		expect( load( make_layer() ).saved_image( choice, 1 ) ).toBe( 5 );
	} );

	test( 's<rrggbb> when the choice draws its colour there', () => {
		const choice = with_get_image( make_choice( { color: '#19F' } ), {} );
		expect( load( make_layer() ).saved_image( choice, 1 ) ).toBe( 's1199ff' );
	} );

	test( 'nothing when it draws neither', () => {
		const choice = with_get_image( make_choice(), {} );
		expect( load( make_layer( { draw_choice_color: false } ) ).saved_image( choice, 1 ) ).toBe( '' );
		expect( load( make_layer() ).saved_image( choice, 2 ) ).toBe( '' );
	} );
} );

describe( 'svg_url and the stack', () => {
	const fill = { color: '#1e90ff', mask: MASK, width: 1200, height: 900 };

	test( 'an SVG of the mask size holding one rectangle of the colour', () => {
		const helper = load( make_layer() );
		const url = helper.svg_url( fill );
		expect( url.indexOf( 'data:image/svg+xml,' ) ).toBe( 0 );
		const svg = decodeURIComponent( url.slice( 'data:image/svg+xml,'.length ) );
		expect( svg ).toContain( 'width="1200" height="900" viewBox="0 0 1200 900"' );
		expect( svg ).toContain( '<rect width="1200" height="900" fill="#1e90ff"/>' );
	} );

	test( 'is_fill_url tells a fill from other data URLs', () => {
		const helper = load( make_layer() );
		expect( helper.is_fill_url( helper.svg_url( fill ) ) ).toBe( true );
		expect( helper.is_fill_url( 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' ) ).toBe( false );
		expect( helper.is_fill_url( 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E' ) ).toBe( false );
		expect( helper.is_fill_url( 'https://example.test/a.png' ) ).toBe( false );
		expect( helper.is_fill_url( undefined ) ).toBe( false );
	} );

	test( 'the stack cuts a fill with the mask, never the placeholder', () => {
		const helper = load( make_layer(), { active: 1 } );
		const layer = make_layer();
		expect( PC.fe.layer_masks.mask_for( layer, helper.svg_url( fill ) ) ).toEqual( MASK );
		expect( PC.fe.layer_masks.mask_for( layer, 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' ) ).toBeNull();
		expect( PC.fe.layer_masks.mask_for( layer, 'https://example.test/fabric.png' ) ).toEqual( MASK );
	} );
} );

describe( 'admin copies (assets/admin/js/views/choice-color.js)', () => {
	function load_both( layer ) {
		const viewers = load( layer );
		const admin_source = fs.readFileSync( path.join( __dirname, '../../admin/js/views/choice-color.js' ), 'utf8' );
		global.PC.views = {};
		global.wp = { hooks: { addAction: () => {} } };
		global.jQuery = () => {};
		( 0, eval )( admin_source );
		return { viewers, admin: PC.views.choice_color_hint };
	}

	test( 'fill_for() and svg_url() agree with the viewers\' on every case', () => {
		const image = { angleId: 1, image: { id: 5, url: 'https://example.test/fabric.png' } };
		const cases = [
			[ make_layer(), make_choice(), 1 ],
			[ make_layer(), make_choice(), 2 ],
			[ make_layer(), make_choice( { color: '#19F' } ), 1 ],
			[ make_layer(), make_choice( { color: 'red' } ), 1 ],
			[ make_layer(), make_choice( {}, [ image ] ), 1 ],
			[ make_layer(), make_choice( { is_group: true } ), 1 ],
			[ make_layer( { draw_choice_color: false } ), make_choice(), 1 ],
			[ make_layer( { type: 'multiple' } ), make_choice(), 1 ],
			[ make_layer( { type: 'group' } ), make_choice(), 1 ],
			[ make_layer( { not_a_choice: true } ), make_choice(), 1 ],
			[ make_layer( { masks: [ { angleId: 1, image: { id: 68, url: MASK.url } } ] } ), make_choice(), 1 ],
			[ make_layer(), make_choice(), '' ],
		];
		cases.forEach( ( [ layer, choice, angle ] ) => {
			const { viewers, admin } = load_both( layer );
			const a = viewers.fill_for( layer, choice, angle );
			const b = admin.fill_for( layer, choice, angle );
			expect( b ).toEqual( a );
			if ( a ) expect( admin.svg_url( b ) ).toBe( viewers.svg_url( a ) );
		} );
	} );
} );
