/**
 * @jest-environment jsdom
 */

/**
 * The Mask section of the layer form (views/layer-masks.js): how masks are
 * stored on the layer, and the size check against the layer's images. The
 * media modal and the markup were checked in the browser.
 */
const fs = require( 'fs' );
const path = require( 'path' );

const source = fs.readFileSync( path.join( __dirname, '../layer-masks.js' ), 'utf8' );

/** The underscore functions the view uses. */
const underscore = {
	find: ( list, callback ) => ( list || [] ).find( callback ),
	reject: ( list, callback ) => ( list || [] ).filter( ( item ) => ! callback( item ) ),
	each: ( list, callback, context ) => ( list || [] ).forEach( ( item ) => callback.call( context, item ) ),
};

/** A Backbone-ish model: get/set, and `change:<key>` counted. */
function make_model( attributes ) {
	const changes = [];
	return {
		id: attributes.id,
		attributes,
		changes,
		get: ( key ) => attributes[ key ],
		set( key, value ) {
			if ( attributes[ key ] !== value ) changes.push( key );
			attributes[ key ] = value;
		},
	};
}

function make_collection( models ) {
	return {
		models,
		each: ( callback, context ) => models.forEach( ( model ) => callback.call( context, model ) ),
		find: ( callback ) => models.find( callback ),
	};
}

/** A choice with one image per entry of `sizes` ({ angleId, width, height }). */
function make_choice( pictures ) {
	return make_model( {
		images: make_collection( pictures.map( ( picture ) => make_model( {
			angleId: picture.angleId,
			image: picture.url === '' ? { url: '' } : {
				url: 'https://example.test/' + picture.angleId + '.png',
				dimensions: picture.width ? { width: picture.width, height: picture.height } : undefined,
			},
		} ) ) ),
	} );
}

let layer_content = {};

function load() {
	const actions = {};
	global._ = underscore;
	global.jQuery = () => ( { closest: () => ( { data: () => null } ) } );
	global.Backbone = {
		View: {
			extend: ( prototype, statics ) => {
				const View = function( options ) {
					this.options = options;
				};
				View.prototype = prototype;
				return Object.assign( View, statics );
			},
		},
	};
	global.wp = {
		template: () => () => '',
		hooks: { addAction: ( name, namespace, callback ) => { actions[ name ] = callback; } },
	};
	global.PC = {
		views: {},
		app: {
			get_layer_content: ( id ) => layer_content[ id ] || null,
			get_collection: () => null,
		},
	};
	global.PC_lang = { mask_size_mismatch: 'Images are %1$s, the mask is %2$s.' };
	( 0, eval )( source );
	return { View: PC.views.layer_masks, actions };
}

/** A view on a layer, without rendering. */
function make_view( View, layer ) {
	const view = Object.create( View.prototype );
	view.layer = layer;
	view.options = {};
	return view;
}

afterEach( () => {
	layer_content = {};
	delete global._;
	delete global.jQuery;
	delete global.Backbone;
	delete global.wp;
	delete global.PC;
	delete global.PC_lang;
} );

describe( 'storing masks on the layer', () => {
	test( 'one entry per view, shaped like a choice image; replacing and removing make a new list', () => {
		const { View } = load();
		const layer = make_model( { id: 4 } );
		const view = make_view( View, layer );
		const image = { id: 10, url: 'mask-front.png', dimensions: { width: 800, height: 600 } };

		expect( view.get_mask( 1 ) ).toBeNull();
		view.set_mask( 1, image );
		expect( layer.get( 'masks' ) ).toEqual( [ { angleId: 1, image } ] );

		const before = layer.get( 'masks' );
		view.set_mask( 2, { id: 11, url: 'mask-back.png' } );
		view.set_mask( 1, { id: 12, url: 'mask-front-2.png' } );
		// A new list each time: Backbone only sees a change when the value is another object.
		expect( layer.get( 'masks' ) ).not.toBe( before );
		expect( layer.changes ).toEqual( [ 'masks', 'masks', 'masks' ] );
		expect( layer.get( 'masks' ).map( ( mask ) => [ mask.angleId, mask.image.id ] ) ).toEqual( [ [ 2, 11 ], [ 1, 12 ] ] );
		// Angle ids may come back from the markup as strings.
		expect( view.get_mask( '2' ).image.id ).toBe( 11 );

		view.set_mask( '1', null );
		expect( layer.get( 'masks' ).map( ( mask ) => mask.angleId ) ).toEqual( [ 2 ] );
	} );

	test( 'a layer without masks, or with a broken entry, reads as no mask', () => {
		const { View } = load();
		const view = make_view( View, make_model( { id: 4, masks: [ null ] } ) );
		expect( view.get_mask( 1 ) ).toBeNull();
		view.set_mask( 1, { id: 1, url: 'm.png' } );
		expect( view.layer.get( 'masks' ) ).toEqual( [ { angleId: 1, image: { id: 1, url: 'm.png' } } ] );
	} );
} );

describe( 'size check', () => {
	test( 'lists the distinct sizes of the view\'s images that differ from the mask', () => {
		const { View } = load();
		layer_content[ 4 ] = make_collection( [
			make_choice( [ { angleId: 1, width: 800, height: 600 }, { angleId: 2, width: 2000, height: 2000 } ] ),
			make_choice( [ { angleId: 1, width: 1600, height: 1200 } ] ),
			make_choice( [ { angleId: 1, width: 1600, height: 1200 } ] ),
			// No dimensions saved, or no image on that view: nothing to say about them.
			make_choice( [ { angleId: 1 } ] ),
			make_choice( [ { angleId: 1, url: '' } ] ),
		] );
		const layer = make_model( { id: 4 } );
		const view = make_view( View, layer );

		expect( View.image_sizes( layer, 1 ) ).toEqual( [
			{ width: 800, height: 600 },
			{ width: 1600, height: 1200 },
			{ width: 1600, height: 1200 },
		] );
		expect( view.size_warning( 1, { width: 800, height: 600 } ) ).toBe( 'Images are 1600 × 1200, the mask is 800 × 600.' );
		expect( view.size_warning( '2', { width: 2000, height: 2000 } ) ).toBe( '' );
		expect( view.size_warning( 2, { width: 1000, height: 1000 } ) ).toBe( 'Images are 2000 × 2000, the mask is 1000 × 1000.' );
		// A mask without known dimensions cannot be checked.
		expect( view.size_warning( 1, undefined ) ).toBe( '' );
	} );

	test( 'a layer without content has nothing to check', () => {
		const { View } = load();
		expect( View.image_sizes( make_model( { id: 9 } ), 1 ) ).toEqual( [] );
		expect( View.size_label( { width: '1200', height: 800 } ) ).toBe( '1200 × 800' );
		expect( View.size_label( null ) ).toBe( '' );
		expect( View.file_name( 'https://example.test/wp-content/uploads/2026/11/sleeve%20mask.png?ver=2' ) ).toBe( 'sleeve mask.png' );
		expect( View.file_name( 'https://example.test/bad%E0.png' ) ).toBe( 'bad%E0.png' );
	} );
} );

describe( 'mounting', () => {
	test( 'only where the form has the Mask section; one view per form, replaced on each render', () => {
		const { actions } = load();
		const mount = actions[ 'PC.admin.layer_form.render' ];
		const removed = [];
		const appended = [];
		const form = {
			model: make_model( { id: 4 } ),
			$el: { hasClass: ( name ) => 'is-global-locked' === name },
			$: () => ( { length: 1, append: ( el ) => appended.push( el ) } ),
		};
		PC.views.layer_masks.prototype.render = function() {
			return { el: this };
		};
		PC.views.layer_masks.prototype.remove = function() {
			removed.push( this );
		};
		mount( form );
		const first = form.layer_masks_view;
		expect( first.options ).toEqual( { layer: form.model, locked: true } );
		mount( form );
		expect( removed ).toEqual( [ first ] );
		expect( appended ).toEqual( [ first, form.layer_masks_view ] );

		const without_section = { model: form.model, $el: form.$el, $: () => ( { length: 0 } ) };
		mount( without_section );
		expect( without_section.layer_masks_view ).toBeUndefined();
	} );
} );

describe( 'masks of another model (PC.views.mask_picker)', () => {
	test( 'any model and list, its own sizes and message, only the views asked for', () => {
		const { View } = load();
		expect( PC.views.mask_picker ).toBe( View );
		const choice = make_model( { id: 7 } );
		const view = Object.create( View.prototype );
		view.model = choice;
		view.attribute = 'zone_masks';
		view.options = {
			angle_ids: () => [ 2 ],
			sizes: ( angle_id ) => ( 2 === Number( angle_id ) ? [ { width: 1000, height: 1000 } ] : [] ),
			size_message: 'The view is %1$s, the mask is %2$s.',
		};

		view.set_mask( 2, { id: 5, url: 'zone.png', dimensions: { width: 800, height: 800 } } );
		expect( choice.get( 'zone_masks' ) ).toEqual( [ { angleId: 2, image: { id: 5, url: 'zone.png', dimensions: { width: 800, height: 800 } } } ] );
		expect( choice.get( 'masks' ) ).toBeUndefined();
		expect( view.get_mask( 2 ).image.id ).toBe( 5 );
		expect( view.size_warning( 2, { width: 800, height: 800 } ) ).toBe( 'The view is 1000 × 1000, the mask is 800 × 800.' );
		expect( view.size_warning( 2, { width: 1000, height: 1000 } ) ).toBe( '' );
		expect( view.lists_angle( 2 ) ).toBe( true );
		expect( view.lists_angle( 1 ) ).toBe( false );
	} );
} );
