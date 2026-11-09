/**
 * @jest-environment jsdom
 */

/**
 * Per-field overrides of a linked global layer (views/layer-overrides.js,
 * docs/global-layer-overrides-spec.md): the data side. The switches in the form were checked in
 * the browser.
 */
const fs = require( 'fs' );
const path = require( 'path' );

const source = fs.readFileSync( path.join( __dirname, '../layer-overrides.js' ), 'utf8' );

/** The underscore functions the module uses. */
const underscore = {
	isArray: Array.isArray,
	isEmpty: ( value ) => ! value || 0 === Object.keys( value ).length,
	extend: ( target, ...sources ) => Object.assign( target, ...sources.filter( Boolean ) ),
	has: ( object, key ) => !! object && Object.prototype.hasOwnProperty.call( object, key ),
	each: ( list, callback ) => ( list || [] ).forEach( callback ),
	keys: ( object ) => Object.keys( object || {} ),
	filter: ( list, callback ) => ( list || [] ).filter( callback ),
	without: ( list, ...values ) => ( list || [] ).filter( ( item ) => ! values.includes( item ) ),
	omit: ( object, keys ) => {
		const out = { ...object };
		keys.forEach( ( key ) => delete out[ key ] );
		return out;
	},
};

/** A Backbone-ish model: get, set( key | attrs, options ), unset, and the options of each set. */
function make_model( attributes ) {
	const sets = [];
	return {
		id: attributes._id,
		attributes,
		sets,
		get: ( key ) => attributes[ key ],
		set( key, value, options ) {
			if ( 'object' === typeof key ) {
				Object.assign( attributes, key );
				sets.push( value || {} );
			} else {
				attributes[ key ] = value;
				sets.push( options || {} );
			}
		},
		unset( key ) {
			delete attributes[ key ];
		},
	};
}

function load( { layers = [], content = {}, groups = { name: [ 'name_fr' ], description: [] } } = {} ) {
	global.PC_lang = { layer_override_groups: groups };
	global.PC = {
		_us: underscore,
		toJSON: ( model ) => JSON.parse( JSON.stringify( model.attributes ) ),
		app: {
			isGlobalLayerStandalone: () => false,
			get_collection: () => ( { each: ( callback ) => layers.forEach( callback ), filter: ( callback ) => layers.filter( callback ) } ),
			get_layer_content: ( id ) => content[ id ],
			get_global_layers: () => ( {
				process_content_layer_id: ( choices, layer_id ) => choices.map( ( choice ) => ( { ...choice, layerId: layer_id } ) ),
			} ),
		},
	};
	global.jQuery = () => {};
	// The file starts with `var PC = PC || {};`: run it where PC is the global one.
	// eslint-disable-next-line no-new-func
	new Function( source.replace( /^var PC = PC \|\| \{\};$/m, 'var PC = window.PC;' ) )();
	return global.PC.admin.layer_overrides;
}

const link = ( extra = {} ) => make_model( {
	_id: 10,
	is_global: true,
	global_id: 345,
	name: 'Fabrics',
	name_fr: 'Tissus',
	admin_label: 'Fabric',
	masks: [ { angleId: 1, image: { id: 5, url: 'global.png' } } ],
	...extra,
} );

describe( 'switching an override', () => {
	test( 'on: the field and its translations become the link\'s, starting from the global value', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'name' );
		const overrides = model.get( 'overrides' );
		expect( overrides.fields ).toEqual( [ 'name', 'name_fr' ] );
		expect( overrides.global ).toEqual( { name: 'Fabrics', name_fr: 'Tissus' } );
		expect( model.get( 'name' ) ).toBe( 'Fabrics' );
		expect( O.is_overridden( model, 'name' ) ).toBe( true );
		expect( O.is_overridden( model, 'admin_label' ) ).toBe( false );
	} );

	test( 'off: the global value comes back, the link\'s value is kept; on again restores it', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'name' );
		model.set( 'name', 'Collar' );
		O.switch_off( model, 'name' );
		expect( model.get( 'name' ) ).toBe( 'Fabrics' );
		expect( model.get( 'overrides' ).fields ).toEqual( [] );
		expect( model.get( 'overrides' ).values.name ).toBe( 'Collar' );
		O.switch_on( model, 'name' );
		expect( model.get( 'name' ) ).toBe( 'Collar' );
	} );

	test( 'a field the global layer does not have: null while overridden, gone once switched off', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'html_id' );
		expect( model.get( 'html_id' ) ).toBeNull();
		expect( model.get( 'overrides' ).fields ).toEqual( [ 'html_id' ] );
		model.set( 'html_id', 'collar' );
		O.switch_off( model, 'html_id' );
		expect( 'html_id' in model.attributes ).toBe( false );
		expect( model.get( 'overrides' ).values.html_id ).toBe( 'collar' );
	} );

	test( 'masks are one value, copied rather than shared', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'masks' );
		model.get( 'masks' )[ 0 ].image.url = 'collar.png';
		expect( model.get( 'overrides' ).global.masks[ 0 ].image.url ).toBe( 'global.png' );
		O.switch_off( model, 'masks' );
		expect( model.get( 'masks' )[ 0 ].image.url ).toBe( 'global.png' );
	} );

	test( 'excluded fields and translations take no switch of their own', () => {
		const O = load();
		expect( O.can_override( 'type' ) ).toBe( false );
		expect( O.can_override( 'html_id' ) ).toBe( true );
		expect( O.follows( 'name_fr' ) ).toBe( 'name' );
		expect( O.follows( 'name' ) ).toBeNull();
	} );

	test( 'not a link: nothing is overridden', () => {
		const O = load();
		const model = link( { is_global: false, overrides: { fields: [ 'name' ], values: { name: 'X' } } } );
		expect( O.is_overridden( model, 'name' ) ).toBe( false );
	} );
} );

describe( 'the global layer', () => {
	test( 'saving it from a link sends the global values, never the link\'s', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'name' );
		model.set( 'name', 'Collar' );
		model.set( 'admin_label', 'Shared label' );
		const data = O.global_attributes( model );
		expect( data.name ).toBe( 'Fabrics' );
		expect( data.name_fr ).toBe( 'Tissus' );
		expect( data.admin_label ).toBe( 'Shared label' );
		expect( data.overrides ).toBeUndefined();
		// The model itself is untouched.
		expect( model.get( 'name' ) ).toBe( 'Collar' );
	} );

	test( 'an overridden field the global layer lacks is left out of the global save', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'html_id' );
		model.set( 'html_id', 'collar' );
		expect( 'html_id' in O.global_attributes( model ) ).toBe( false );
	} );

	test( 'a new definition reaches the inherited fields only', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'name' );
		model.set( 'name', 'Collar' );
		O.apply_global( model, { _id: 1, is_global: false, name: 'Cloth', name_fr: 'Étoffe', admin_label: 'New label' }, { pc_from_global: true } );
		expect( model.get( 'name' ) ).toBe( 'Collar' );
		expect( model.get( 'admin_label' ) ).toBe( 'New label' );
		expect( model.get( '_id' ) ).toBe( 10 );
		expect( model.get( 'is_global' ) ).toBe( true );
		expect( model.get( 'overrides' ).global.name ).toBe( 'Cloth' );
		expect( model.sets[ model.sets.length - 1 ] ).toEqual( { pc_from_global: true } );
		O.switch_off( model, 'name' );
		expect( model.get( 'name' ) ).toBe( 'Cloth' );
		expect( model.get( 'name_fr' ) ).toBe( 'Étoffe' );
	} );

	test( 'after a save, the other links get the settings and the choices', () => {
		const resets = {};
		const content = {
			10: { reset: ( choices ) => ( resets[ 10 ] = choices ) },
			11: { reset: ( choices ) => ( resets[ 11 ] = choices ) },
		};
		const first = link();
		const second = link( { _id: 11 } );
		const other = make_model( { _id: 12, is_global: true, global_id: 999, name: 'Other' } );
		const O = load( { layers: [ first, second, other ], content } );
		O.switch_on( second, 'name' );
		second.set( 'name', 'Sleeves' );
		O.refresh_links( 345, { name: 'Cloth', admin_label: 'New' }, [ { _id: 1, layerId: 10, name: 'Blue' } ] );
		expect( first.get( 'name' ) ).toBe( 'Cloth' );
		expect( second.get( 'name' ) ).toBe( 'Sleeves' );
		expect( second.get( 'admin_label' ) ).toBe( 'New' );
		expect( other.get( 'name' ) ).toBe( 'Other' );
		// The choices were edited from link 10: only the other link reloads them, under its id.
		expect( resets[ 10 ] ).toBeUndefined();
		expect( resets[ 11 ] ).toEqual( [ { _id: 1, layerId: 11, name: 'Blue' } ] );
	} );
} );

describe( 'Edit original', () => {
	test( 'shows the global values of overridden fields, and gives the link\'s back when cancelled', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'name' );
		model.set( 'name', 'Collar' );
		O.enter_original( model );
		expect( O.is_editing_original( model ) ).toBe( true );
		expect( model.get( 'name' ) ).toBe( 'Fabrics' );
		expect( model.sets[ model.sets.length - 1 ] ).toEqual( { pc_from_global: true } );
		model.set( 'name', 'Cloth' );
		O.leave_original( model, false );
		expect( O.is_editing_original( model ) ).toBe( false );
		expect( model.get( 'name' ) ).toBe( 'Collar' );
		expect( model.get( 'overrides' ).global.name ).toBe( 'Fabrics' );
		expect( 'editing_original' in model.get( 'overrides' ) ).toBe( false );
	} );

	test( 'saved: the edited global value is the new global one, the link keeps its own', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'name' );
		model.set( 'name', 'Collar' );
		O.enter_original( model );
		model.set( 'name', 'Cloth' );
		model.set( 'admin_label', 'Shared' );
		const payload = O.global_attributes( model );
		expect( payload.name ).toBe( 'Cloth' );
		expect( payload.admin_label ).toBe( 'Shared' );
		expect( payload.overrides ).toBeUndefined();
		O.leave_original( model, true );
		expect( model.get( 'name' ) ).toBe( 'Collar' );
		expect( model.get( 'overrides' ).global.name ).toBe( 'Cloth' );
		O.switch_off( model, 'name' );
		expect( model.get( 'name' ) ).toBe( 'Cloth' );
	} );

	test( 'edits made in it are the global layer\'s, overridden fields included', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'name' );
		O.enter_original( model );
		expect( O.classify_changes( model, { name: 'A' } ) ).toEqual( { own: false, global: true } );
	} );

	test( 'entering twice keeps the link\'s values', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'name' );
		model.set( 'name', 'Collar' );
		O.enter_original( model );
		O.enter_original( model );
		O.leave_original( model, false );
		expect( model.get( 'name' ) ).toBe( 'Collar' );
	} );
} );

describe( 'what a change of a link is', () => {
	test( 'an overridden field or the switches are the link\'s; the rest the global layer\'s', () => {
		const O = load();
		const model = link();
		O.switch_on( model, 'name' );
		expect( O.classify_changes( model, { name: 'A' } ) ).toEqual( { own: true, global: false } );
		expect( O.classify_changes( model, { overrides: {} } ) ).toEqual( { own: true, global: false } );
		expect( O.classify_changes( model, { admin_label: 'B' } ) ).toEqual( { own: false, global: true } );
		expect( O.classify_changes( model, { name: 'A', admin_label: 'B', active: true } ) ).toEqual( { own: true, global: true } );
	} );

	test( 'links to a global layer are counted', () => {
		const O = load( { layers: [ link(), link( { _id: 11 } ), make_model( { _id: 12, is_global: false } ) ] } );
		expect( O.count_links( 345 ) ).toBe( 2 );
		expect( O.count_links( '345' ) ).toBe( 2 );
		expect( O.count_links( 1 ) ).toBe( 0 );
	} );
} );
