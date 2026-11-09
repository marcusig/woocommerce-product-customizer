/**
 * PC.fe.viewer_state replaced two copies of the same rule: the viewer's
 * get_capture_models() and the image pool's get_visible_choices(). These tests
 * hold it to the old code, verbatim, over many random configurations, so the
 * extraction is known not to change what is shown or captured.
 */
const fs = require( 'fs' );
const path = require( 'path' );

const source = fs.readFileSync( path.join( __dirname, '../views/parts/viewer-state.js' ), 'utf8' );

/** The two underscore functions the code under test and the references use. */
const underscore = {
	each: ( list, callback, context ) => list.forEach( ( item, index ) => callback.call( context, item, index ) ),
	filter: ( list, callback ) => list.filter( callback ),
};

function make_model( attributes ) {
	return {
		id: attributes.id,
		attributes,
		get: ( key ) => attributes[ key ],
		has_image: () => !! attributes.image,
	};
}

/** Enough of a Backbone collection for these call sites. */
function make_collection( models ) {
	return {
		models,
		length: models.length,
		first: () => models[ 0 ],
		each: ( callback ) => models.forEach( callback ),
		filter: ( callback ) => models.filter( callback ),
		get: ( id ) => models.find( ( model ) => model.id === id ),
		// Stable, like _.sortBy.
		sortBy: ( iteratee ) => models
			.map( ( model, index ) => ( { model, index, key: iteratee( model ) } ) )
			.sort( ( a, b ) => ( a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index ) )
			.map( ( entry ) => entry.model ),
	};
}

/** Small seeded PRNG, so a failure is reproducible. */
function make_random( seed ) {
	let state = seed;
	return () => {
		state = ( state * 1664525 + 1013904223 ) % 4294967296;
		return state / 4294967296;
	};
}

function pick( random, values ) {
	return values[ Math.floor( random() * values.length ) ];
}

/**
 * A random configuration: layers with and without image order, static layers,
 * groups, multiple active choices, choices without images, `cshow` true, false
 * or unset, and a "text-overlay" layer type that draws without an image.
 */
function make_configuration( random ) {
	const layers = [];
	const contents = {};
	const layer_count = 1 + Math.floor( random() * 7 );
	const uses_image_order = random() < 0.6;

	for ( let layer_index = 0; layer_index < layer_count; layer_index++ ) {
		const layer_id = layer_index + 1;
		const layer = make_model( {
			id: layer_id,
			image_order: uses_image_order ? pick( random, [ 0, 1, 2, 3, '2', '' ] ) : 0,
			not_a_choice: random() < 0.15,
			cshow: pick( random, [ true, false, undefined, undefined ] ),
			hidden_by_conditions: random() < 0.15,
		} );
		layers.push( layer );

		const layer_type = random() < 0.2 ? 'text-overlay' : 'simple';
		const choice_count = Math.floor( random() * 5 );
		const choices = [];
		for ( let choice_index = 0; choice_index < choice_count; choice_index++ ) {
			choices.push( make_model( {
				id: choice_index + 1,
				layerId: layer_id,
				layer_type,
				active: random() < 0.5,
				is_group: random() < 0.1,
				image: random() < 0.75,
				cshow: pick( random, [ true, false, undefined, undefined ] ),
				hidden_by_conditions: random() < 0.15,
			} ) );
		}
		// A layer can have no content at all.
		contents[ layer_id ] = random() < 0.05 ? false : make_collection( choices );
	}

	return { layers: make_collection( layers ), contents };
}

/** Conditional logic, as far as these rules use it. */
const conditional_logic = {
	item_is_hidden: ( choice ) => false === choice.get( 'cshow' ) || choice.get( 'hidden_by_conditions' ),
	parent_is_hidden: ( layer ) => layer.get( 'hidden_by_conditions' ),
};

function install( configuration, with_conditional_logic ) {
	global._ = underscore;
	global.wp = {
		hooks: {
			applyFilters: ( name, value, choice ) => {
				if ( 'PC.fe.viewer.item.render.empty.images' === name ) {
					return 'text-overlay' === choice.get( 'layer_type' ) ? true : value;
				}
				return value;
			},
		},
	};
	global.PC = {
		fe: {
			layers: configuration.layers,
			getLayerContent: ( id ) => configuration.contents[ id ],
		},
		conditionalLogic: with_conditional_logic ? conditional_logic : undefined,
	};
	( 0, eval )( source );
}

/*
 * The code that was replaced, copied verbatim from viewer.js and viewer-layer.js
 * (master, v2.1.0) except for the parent/this plumbing it needs to run here.
 */
const reference = {
	is_hidden_by_conditions( choice ) {
		if ( PC.conditionalLogic && PC.conditionalLogic.item_is_hidden ) {
			return !! PC.conditionalLogic.item_is_hidden( choice );
		}
		if ( false === choice.get( 'cshow' ) ) return true;
		const layer = PC.fe.layers.get( choice.get( 'layerId' ) );
		return !! ( layer && false === layer.get( 'cshow' ) );
	},

	is_hidden_by_conditions_layer( layer ) {
		if ( false === layer.get( 'cshow' ) ) return true;
		if ( PC.conditionalLogic && PC.conditionalLogic.parent_is_hidden ) {
			return !! PC.conditionalLogic.parent_is_hidden( layer );
		}
		return false;
	},

	get_capture_models() {
		const models = [];
		const that = this;
		const ordered = PC.fe.layers.sortBy( function( layer ) {
			return parseInt( layer.get( 'image_order' ) ) || 0;
		} );

		_.each( ordered, function( layer ) {
			const choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return;
			if ( that.is_hidden_by_conditions_layer( layer ) ) return;

			if ( layer.get( 'not_a_choice' ) ) {
				const first = choices.first();
				if ( first ) models.push( first );
				return;
			}

			choices.each( function( choice ) {
				if ( ! choice.get( 'active' ) ) return;
				if ( choice.get( 'is_group' ) ) return;
				if ( that.is_hidden_by_conditions( choice ) ) return;
				models.push( choice );
			} );
		} );
		return models;
	},

	// viewer_layer_pool.get_visible_choices(), with this.parent = reference.
	get_visible_choices( layer ) {
		if ( this.is_hidden_by_conditions_layer( layer ) ) return [];

		const that = this;
		return PC.fe.getLayerContent( layer.id ).filter( function( choice ) {
			if ( ! choice.get( 'active' ) ) return false;
			if ( choice.get( 'is_group' ) ) return false;
			if ( that.is_hidden_by_conditions( choice ) ) return false;
			return choice.has_image() || wp.hooks.applyFilters( 'PC.fe.viewer.item.render.empty.images', false, choice );
		} );
	},
};

/** The new viewer_layer_pool.get_visible_choices() body. */
function pool_visible_choices( layer ) {
	const state = PC.fe.viewer_state;
	return _.filter( state.shown_choices( layer ), function( choice ) {
		return state.has_drawable( choice );
	} );
}

/** Layers the pool manages: never static, and only with content (see viewer.add_choices / pool.initialize). */
function pooled_layers( configuration ) {
	return configuration.layers.models.filter( ( layer ) => ! layer.get( 'not_a_choice' ) && configuration.contents[ layer.id ] );
}

afterEach( () => {
	delete global.PC;
	delete global.wp;
	delete global._;
} );

describe.each( [
	[ 'without conditional logic', false ],
	[ 'with conditional logic', true ],
] )( 'PC.fe.viewer_state %s', ( label, with_conditional_logic ) => {
	test( 'picture() matches the old get_capture_models()', () => {
		for ( let seed = 1; seed <= 1000; seed++ ) {
			const configuration = make_configuration( make_random( seed ) );
			install( configuration, with_conditional_logic );
			expect( { seed, models: PC.fe.viewer_state.picture() } )
				.toEqual( { seed, models: reference.get_capture_models() } );
		}
	} );

	test( 'the pool sees the same choices as before', () => {
		for ( let seed = 1; seed <= 1000; seed++ ) {
			const configuration = make_configuration( make_random( seed ) );
			install( configuration, with_conditional_logic );
			pooled_layers( configuration ).forEach( ( layer ) => {
				expect( { seed, layer: layer.id, choices: pool_visible_choices( layer ) } )
					.toEqual( { seed, layer: layer.id, choices: reference.get_visible_choices( layer ) } );
			} );
		}
	} );

	test( 'the hidden checks match the old viewer methods', () => {
		for ( let seed = 1; seed <= 300; seed++ ) {
			const configuration = make_configuration( make_random( seed ) );
			install( configuration, with_conditional_logic );
			configuration.layers.models.forEach( ( layer ) => {
				expect( PC.fe.viewer_state.is_layer_hidden( layer ) ).toBe( reference.is_hidden_by_conditions_layer( layer ) );
				const choices = configuration.contents[ layer.id ];
				if ( ! choices ) return;
				choices.models.forEach( ( choice ) => {
					expect( PC.fe.viewer_state.is_choice_hidden( choice ) ).toBe( reference.is_hidden_by_conditions( choice ) );
				} );
			} );
		}
	} );
} );

describe( 'PC.fe.viewer_state rules', () => {
	test( 'a static layer shows its first choice whatever its state, unless the layer is hidden', () => {
		const choice = make_model( { id: 1, layerId: 1, active: false, is_group: true, image: false, cshow: false } );
		const layer = make_model( { id: 1, not_a_choice: true } );
		install( { layers: make_collection( [ layer ] ), contents: { 1: make_collection( [ choice ] ) } }, false );
		expect( PC.fe.viewer_state.shown_choices( layer ) ).toEqual( [ choice ] );

		layer.attributes.cshow = false;
		expect( PC.fe.viewer_state.shown_choices( layer ) ).toEqual( [] );
	} );

	test( 'a multiple-choice layer shows every active choice, in layer order', () => {
		const choices = [ 1, 2, 3 ].map( ( id ) => make_model( { id, layerId: 1, active: 2 !== id, image: true } ) );
		const layer = make_model( { id: 1 } );
		install( { layers: make_collection( [ layer ] ), contents: { 1: make_collection( choices ) } }, false );
		expect( PC.fe.viewer_state.shown_choices( layer ).map( ( choice ) => choice.id ) ).toEqual( [ 1, 3 ] );
	} );

	test( 'has_drawable() accepts an image, or a layer type that draws itself', () => {
		install( { layers: make_collection( [] ), contents: {} }, false );
		expect( PC.fe.viewer_state.has_drawable( make_model( { image: true } ) ) ).toBe( true );
		expect( PC.fe.viewer_state.has_drawable( make_model( { image: false } ) ) ).toBe( false );
		expect( PC.fe.viewer_state.has_drawable( make_model( { image: false, layer_type: 'text-overlay' } ) ) ).toBe( true );
	} );

	test( 'layers sort by image order, keeping their order on ties and when unset', () => {
		const layers = [
			make_model( { id: 1, image_order: 2 } ),
			make_model( { id: 2, image_order: '' } ),
			make_model( { id: 3, image_order: '1' } ),
			make_model( { id: 4 } ),
		];
		install( { layers: make_collection( layers ), contents: {} }, false );
		expect( PC.fe.viewer_state.layers_in_image_order().map( ( layer ) => layer.id ) ).toEqual( [ 2, 4, 3, 1 ] );
	} );
} );
