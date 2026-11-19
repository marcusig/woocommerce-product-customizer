/**
 * @jest-environment jsdom
 */

/**
 * Per-field overrides of the choices of a linked global layer (views/choice-overrides.js,
 * docs/global-layer-choice-overrides-spec.md): the data side. The switches in the form were checked
 * in the browser.
 */
const file_system = require( 'fs' );
const path = require( 'path' );

const layer_source = file_system.readFileSync( path.join( __dirname, '../layer-overrides.js' ), 'utf8' );
const choice_source = file_system.readFileSync( path.join( __dirname, '../choice-overrides.js' ), 'utf8' );

/** The underscore functions the modules use. */
const underscore = {
	isArray: Array.isArray,
	isEmpty: ( value ) => ! value || 0 === Object.keys( value ).length,
	extend: ( target, ...sources ) => Object.assign( target, ...sources.filter( Boolean ) ),
	has: ( object, key ) => !! object && Object.prototype.hasOwnProperty.call( object, key ),
	each: ( list, callback ) => ( list || [] ).forEach( callback ),
	keys: ( object ) => Object.keys( object || {} ),
	filter: ( list, callback ) => ( list || [] ).filter( callback ),
	map: ( list, callback ) => ( list || [] ).map( callback ),
	without: ( list, ...values ) => ( list || [] ).filter( ( item ) => ! values.includes( item ) ),
	omit: ( object, keys ) => {
		const output = { ...object };
		keys.forEach( ( key ) => delete output[ key ] );
		return output;
	},
};

/** A Backbone-ish model: get, set( key | attrs, options ), unset, and the options of each set. */
function make_model( attributes, collection ) {
	const sets = [];
	return {
		id: attributes._id,
		attributes,
		collection,
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
		toJSON: () => JSON.parse( JSON.stringify( attributes ) ),
	};
}

function make_collection( models ) {
	const collection = {
		models,
		each: ( callback ) => models.forEach( callback ),
	};
	models.forEach( ( model ) => {
		model.collection = collection;
	} );
	return collection;
}

function load( { standalone = false, editing = false, groups = { name: [ 'name_fr' ], description: [] } } = {} ) {
	const layer = make_model( { _id: 10, is_global: true, global_id: 345 } );
	const local = make_model( { _id: 11, is_global: false } );
	global.PC_lang = { choice_override_groups: groups, layer_override_groups: {} };
	global.PC = {
		_us: underscore,
		toJSON: ( model ) => JSON.parse( JSON.stringify( model.attributes ) ),
		app: {
			isGlobalLayerStandalone: () => standalone,
			get_collection: () => ( { get: ( id ) => ( { 10: layer, 11: local } )[ id ] } ),
			get_global_layers: () => ( { is_editing_choices: () => editing } ),
		},
	};
	global.jQuery = () => {};
	// The files start with `var PC = PC || {};`: run them where PC is the global one.
	[ layer_source, choice_source ].forEach( ( source ) => {
		// eslint-disable-next-line no-new-func
		new Function( source.replace( /^var PC = PC \|\| \{\};$/m, 'var PC = window.PC;' ) )();
	} );
	return global.PC.admin.choice_overrides;
}

const choice = ( extra = {}, layerId = 10 ) => make_model( {
	_id: 7,
	layerId,
	name: 'Cotton',
	extra_price: 10,
	sku: 'FAB-07',
	is_default: false,
	...extra,
} );

describe( 'which choices are links', () => {
	test( 'a choice of a linked layer is, one of a local layer or of the layer\'s own screen is not', () => {
		expect( load().is_link( choice() ) ).toBe( true );
		expect( load().is_link( choice( {}, 11 ) ) ).toBe( false );
		expect( load( { standalone: true } ).is_link( choice() ) ).toBe( false );
	} );

	test( 'system fields take no switch, nor do translations', () => {
		const Choice_Overrides = load();
		[ '_id', 'id', 'layerId', 'is_group', 'parent', 'order', 'overrides' ].forEach( ( field ) => {
			expect( Choice_Overrides.can_override( field ) ).toBe( false );
		} );
		expect( Choice_Overrides.can_override( 'extra_price' ) ).toBe( true );
		expect( Choice_Overrides.can_override( 'sku' ) ).toBe( true );
		expect( Choice_Overrides.follows( 'name_fr' ) ).toBe( 'name' );
		expect( Choice_Overrides.follows( 'name' ) ).toBe( null );
	} );
} );

describe( 'switching a field of a choice', () => {
	test( 'on: first from the global value, afterwards from the kept value; off: global back, link\'s kept', () => {
		const Choice_Overrides = load();
		const model = choice();
		Choice_Overrides.switch_on( model, 'extra_price' );
		expect( model.get( 'overrides' ).fields ).toEqual( [ 'extra_price' ] );
		expect( model.get( 'overrides' ).global ).toEqual( { extra_price: 10 } );
		expect( model.get( 'extra_price' ) ).toBe( 10 );

		model.set( 'extra_price', 15 );
		Choice_Overrides.switch_off( model, 'extra_price' );
		expect( model.get( 'extra_price' ) ).toBe( 10 );
		expect( model.get( 'overrides' ).fields ).toEqual( [] );
		expect( model.get( 'overrides' ).values.extra_price ).toBe( 15 );

		Choice_Overrides.switch_on( model, 'extra_price' );
		expect( model.get( 'extra_price' ) ).toBe( 15 );
		expect( model.get( 'overrides' ).global.extra_price ).toBe( 10 );
	} );

	test( 'a translation follows its field', () => {
		const Choice_Overrides = load();
		const model = choice( { name_fr: 'Coton' } );
		Choice_Overrides.switch_on( model, 'name' );
		expect( model.get( 'overrides' ).fields.sort() ).toEqual( [ 'name', 'name_fr' ] );
		Choice_Overrides.switch_off( model, 'name' );
		expect( model.get( 'overrides' ).fields ).toEqual( [] );
	} );

	test( 'a field the global choice has no value for is listed with null, and unset when switched off', () => {
		const Choice_Overrides = load();
		const model = choice();
		Choice_Overrides.switch_on( model, 'linked_product_id' );
		expect( model.get( 'overrides' ).values.linked_product_id ).toBe( null );
		model.set( 'linked_product_id', 812 );
		Choice_Overrides.switch_off( model, 'linked_product_id' );
		expect( 'linked_product_id' in model.attributes ).toBe( false );
	} );

	test( 'a choice with nothing overridden carries no overrides at all', () => {
		const Choice_Overrides = load();
		const model = choice();
		Choice_Overrides.switch_on( model, 'sku' );
		Choice_Overrides.switch_off( model, 'sku' );
		expect( model.get( 'overrides' ).values.sku ).toBe( 'FAB-07' );
		const other = choice( { _id: 8 } );
		expect( 'overrides' in other.attributes ).toBe( false );
		Choice_Overrides.enter_all( make_collection( [ other ] ) );
		expect( 'overrides' in other.attributes ).toBe( false );
	} );
} );

describe( 'saving the global layer', () => {
	test( 'the payload takes the global value of every overridden field, and carries no overrides', () => {
		const Choice_Overrides = load();
		const model = choice();
		Choice_Overrides.switch_on( model, 'extra_price' );
		Choice_Overrides.switch_on( model, 'linked_product_id' );
		model.set( { extra_price: 15, linked_product_id: 812, sku: 'SHARED' } );
		const payload = Choice_Overrides.payload( model );
		expect( payload.extra_price ).toBe( 10 );
		expect( 'linked_product_id' in payload ).toBe( false );
		expect( payload.sku ).toBe( 'SHARED' );
		expect( payload.overrides ).toBeUndefined();
		// The model keeps the link's values.
		expect( model.get( 'extra_price' ) ).toBe( 15 );
	} );

	test( 'a choice without overrides, or on the layer\'s own screen, goes as it is', () => {
		const model = choice();
		expect( load().payload( model ).extra_price ).toBe( 10 );
		expect( load( { standalone: true } ).payload( model ).sku ).toBe( 'FAB-07' );
	} );
} );

describe( 'Edit original', () => {
	test( 'shows the global values of overridden fields, and gives the link\'s back when left', () => {
		const Choice_Overrides = load();
		const model = choice();
		const plain = choice( { _id: 8 } );
		const collection = make_collection( [ model, plain ] );
		Choice_Overrides.switch_on( model, 'extra_price' );
		model.set( 'extra_price', 15 );

		Choice_Overrides.enter_all( collection );
		expect( model.get( 'extra_price' ) ).toBe( 10 );
		expect( model.get( 'overrides' ).editing_original ).toBe( true );
		expect( 'overrides' in plain.attributes ).toBe( false );
		expect( Choice_Overrides.has_overrides( model ) ).toBe( false );
		// Not a change of the product, nor of the global layer.
		expect( model.sets[ model.sets.length - 1 ].pc_from_global ).toBe( true );

		Choice_Overrides.leave_all( collection, false );
		expect( model.get( 'extra_price' ) ).toBe( 15 );
		expect( 'editing_original' in model.get( 'overrides' ) ).toBe( false );
		expect( Choice_Overrides.has_overrides( model ) ).toBe( true );
	} );

	test( 'saved: the edited value is the new global one', () => {
		const Choice_Overrides = load();
		const model = choice();
		const collection = make_collection( [ model ] );
		Choice_Overrides.switch_on( model, 'extra_price' );
		model.set( 'extra_price', 15 );
		Choice_Overrides.enter_all( collection );
		model.set( 'extra_price', 12 );
		expect( Choice_Overrides.payload( model ).extra_price ).toBe( 12 );
		Choice_Overrides.leave_all( collection, true );
		expect( model.get( 'extra_price' ) ).toBe( 15 );
		expect( model.get( 'overrides' ).global.extra_price ).toBe( 12 );
	} );

	test( 'its edits are the global layer\'s, overridden fields included', () => {
		const Choice_Overrides = load();
		const model = choice();
		Choice_Overrides.switch_on( model, 'extra_price' );
		expect( Choice_Overrides.classify_changes( model, { extra_price: 1 } ) ).toEqual( { own: true, global: false } );
		Choice_Overrides.enter_all( make_collection( [ model ] ) );
		expect( Choice_Overrides.classify_changes( model, { extra_price: 1 } ) ).toEqual( { own: false, global: true } );
	} );
} );

describe( 'a new definition of the global choices reaching a link', () => {
	const global_choices = () => [
		{ _id: 7, layerId: 12, name: 'Cotton', extra_price: 20, sku: 'FAB-07', is_default: false, order: 1 },
		{ _id: 8, layerId: 12, name: 'Silk', extra_price: 30, order: 2 },
	];

	test( 'the link keeps its values, the global ones are updated', () => {
		const Choice_Overrides = load();
		const model = choice();
		Choice_Overrides.switch_on( model, 'extra_price' );
		model.set( 'extra_price', 15 );
		const data = Choice_Overrides.rebase( [ model ], global_choices() );
		expect( data[ 0 ].extra_price ).toBe( 15 );
		expect( data[ 0 ].overrides.fields ).toEqual( [ 'extra_price' ] );
		expect( data[ 0 ].overrides.global ).toEqual( { extra_price: 20 } );
		expect( data[ 0 ].overrides.values.extra_price ).toBe( 15 );
		expect( data[ 0 ].name ).toBe( 'Cotton' );
		// A choice without overrides is the global one.
		expect( data[ 1 ].extra_price ).toBe( 30 );
		expect( data[ 1 ].overrides ).toBeUndefined();
	} );

	test( 'a choice deleted by the save loses its entry', () => {
		const Choice_Overrides = load();
		const model = choice();
		Choice_Overrides.switch_on( model, 'extra_price' );
		const data = Choice_Overrides.rebase( [ model ], global_choices().slice( 1 ) );
		expect( data ).toHaveLength( 1 );
		expect( data[ 0 ]._id ).toBe( 8 );
		expect( data[ 0 ].overrides ).toBeUndefined();
	} );

	test( 'a field the new global choice no longer has stays the link\'s', () => {
		const Choice_Overrides = load();
		const model = choice();
		Choice_Overrides.switch_on( model, 'sku' );
		model.set( 'sku', 'LINK' );
		const global = global_choices();
		delete global[ 0 ].sku;
		const data = Choice_Overrides.rebase( [ model ], global );
		expect( data[ 0 ].sku ).toBe( 'LINK' );
		expect( data[ 0 ].overrides.global ).toEqual( {} );
	} );

	test( 'while the link edits the original it keeps showing the global values; leaving gives the link\'s back', () => {
		const Choice_Overrides = load();
		const model = choice();
		Choice_Overrides.switch_on( model, 'extra_price' );
		model.set( 'extra_price', 15 );
		Choice_Overrides.enter_all( make_collection( [ model ] ) );

		const editing = Choice_Overrides.rebase( [ model ], global_choices() );
		expect( editing[ 0 ].extra_price ).toBe( 20 );
		expect( editing[ 0 ].overrides.editing_original ).toBe( true );
		expect( editing[ 0 ].overrides.values.extra_price ).toBe( 15 );

		// Cancelled: the stored global choices, the link's own values back.
		const left = Choice_Overrides.rebase( [ model ], global_choices(), { leave: true } );
		expect( left[ 0 ].extra_price ).toBe( 15 );
		expect( left[ 0 ].overrides.editing_original ).toBeUndefined();
		expect( left[ 0 ].overrides.global.extra_price ).toBe( 20 );
	} );

	test( 'switched-off values are kept', () => {
		const Choice_Overrides = load();
		const model = choice();
		Choice_Overrides.switch_on( model, 'sku' );
		model.set( 'sku', 'LINK' );
		Choice_Overrides.switch_off( model, 'sku' );
		const data = Choice_Overrides.rebase( [ model ], global_choices() );
		expect( data[ 0 ].overrides.fields ).toEqual( [] );
		expect( data[ 0 ].overrides.values.sku ).toBe( 'LINK' );
		expect( data[ 0 ].sku ).toBe( 'FAB-07' );
	} );
} );

describe( 'the default choice of a link', () => {
	test( 'making one default overrides the other default choices of the link, without touching the global layer', () => {
		const Choice_Overrides = load();
		const first_default = choice( { _id: 1, is_default: true } );
		const new_default = choice( { _id: 2 } );
		make_collection( [ first_default, new_default ] );
		Choice_Overrides.clear_other_defaults( new_default );
		expect( first_default.get( 'is_default' ) ).toBe( false );
		expect( first_default.get( 'overrides' ).fields ).toEqual( [ 'is_default' ] );
		expect( first_default.get( 'overrides' ).global.is_default ).toBe( true );
		expect( Choice_Overrides.payload( first_default ).is_default ).toBe( true );
	} );
} );

describe( 'the row mark', () => {
	test( 'only a choice with overridden fields, and not while the original is edited', () => {
		const Choice_Overrides = load();
		const model = choice();
		expect( Choice_Overrides.has_overrides( model ) ).toBe( false );
		Choice_Overrides.switch_on( model, 'sku' );
		expect( Choice_Overrides.has_overrides( model ) ).toBe( true );
		Choice_Overrides.enter_all( make_collection( [ model ] ) );
		expect( Choice_Overrides.has_overrides( model ) ).toBe( false );
	} );
} );

describe( 'disconnecting the layer', () => {
	test( 'the choices keep the values they show, the overrides are gone', () => {
		const Choice_Overrides = load();
		const model = choice();
		const collection = make_collection( [ model ] );
		Choice_Overrides.switch_on( model, 'extra_price' );
		model.set( 'extra_price', 15 );
		Choice_Overrides.enter_all( collection );
		Choice_Overrides.disconnect( collection );
		expect( model.get( 'extra_price' ) ).toBe( 15 );
		expect( 'overrides' in model.attributes ).toBe( false );
	} );
} );
