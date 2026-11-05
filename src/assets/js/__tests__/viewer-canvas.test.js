/**
 * @jest-environment jsdom
 */

/**
 * The parts of the canvas viewer that do not need WebGL: which viewer a
 * product gets, the fallbacks decided before mounting, and turning Pixi's
 * premultiplied read-back into straight alpha. Drawing itself was checked in
 * the browser (see the phase 2 notes in docs/canvas-viewer-spec.md).
 */
const fs = require( 'fs' );
const path = require( 'path' );

const source = fs.readFileSync( path.join( __dirname, '../views/parts/viewer-canvas.js' ), 'utf8' );

/** A small wp.hooks: priorities, filters and actions, like @wordpress/hooks. */
function make_hooks() {
	const filters = {};
	const actions = {};
	const add = ( store ) => ( name, namespace, callback, priority = 10 ) => {
		store[ name ] = ( store[ name ] || [] ).filter( ( hook ) => hook.namespace !== namespace );
		store[ name ].push( { namespace, callback, priority } );
		store[ name ].sort( ( a, b ) => a.priority - b.priority );
	};
	return {
		addFilter: add( filters ),
		addAction: add( actions ),
		applyFilters: ( name, value, ...args ) => ( filters[ name ] || [] ).reduce( ( current, hook ) => hook.callback( current, ...args ), value ),
		doAction: ( name, ...args ) => ( actions[ name ] || [] ).forEach( ( hook ) => hook.callback( ...args ) ),
	};
}

function make_model( attributes ) {
	return { id: attributes.id, get: ( key ) => attributes[ key ] };
}

function make_collection( models ) {
	return { find: ( callback ) => models.find( callback ) };
}

const Default_Viewer = function() {};
const Default_Layer_View = function() {};
const Viewer_3d = function() {};

function load( { config = {}, pixi = 'webgl', layers = [], contents = {} } = {} ) {
	const hooks = make_hooks();
	const fired = [];
	hooks.addAction( 'PC.fe.viewer.canvas.fallback', 'test', ( reason, detail ) => fired.push( { reason, detail } ) );
	hooks.addAction( 'PC.fe.viewer.webgl.unavailable', 'test', () => fired.push( { webgl_unavailable: true } ) );

	global.wp = { hooks, template: () => () => '' };
	global.Backbone = {
		View: {
			extend: ( prototype, statics ) => {
				const View = function() {};
				View.prototype = prototype;
				return Object.assign( View, statics );
			},
		},
	};
	global.PC = {
		fe: {
			config,
			views: { viewer: Default_Viewer, viewer_layer: Default_Layer_View },
			layers: make_collection( layers ),
			contents: {},
			getLayerContent: ( id ) => contents[ id ],
		},
	};
	global.PIXI = null === pixi ? undefined : {
		Application: function() {},
		Texture: {},
		isWebGLSupported: () => 'webgl' === pixi,
	};
	jest.spyOn( console, 'log' ).mockImplementation( () => {} );
	( 0, eval )( source );
	return { hooks, fired, main_view: () => hooks.applyFilters( 'PC.fe.viewer.main_view', Default_Viewer ) };
}

afterEach( () => {
	jest.restoreAllMocks();
	delete global.PC;
	delete global.wp;
	delete global.Backbone;
	delete global.PIXI;
} );

describe( 'choosing the renderer', () => {
	test( 'the image stack unless the setting says canvas', () => {
		expect( load().main_view() ).toBe( Default_Viewer );
		expect( load( { config: { viewer_2d_renderer: 'dom' } } ).main_view() ).toBe( Default_Viewer );
		expect( load( { config: { viewer_2d_renderer: 'canvas' } } ).main_view() ).toBe( PC.fe.views.viewer_canvas );
	} );

	test( 'the PC.fe.viewer.renderer filter has the last word, and only knows two values', () => {
		const loaded = load( { config: { viewer_2d_renderer: 'dom' } } );
		loaded.hooks.addFilter( 'PC.fe.viewer.renderer', 'test', () => 'canvas' );
		expect( loaded.main_view() ).toBe( PC.fe.views.viewer_canvas );

		loaded.hooks.addFilter( 'PC.fe.viewer.renderer', 'test', () => 'something-else' );
		expect( PC.fe.views.viewer_canvas.renderer() ).toBe( 'dom' );
		expect( loaded.main_view() ).toBe( Default_Viewer );
	} );

	test( 'a viewer another filter chose (3D) is left alone', () => {
		const loaded = load( { config: { viewer_2d_renderer: 'canvas' } } );
		loaded.hooks.addFilter( 'PC.fe.viewer.main_view', 'PC.fe.3d', () => Viewer_3d );
		expect( loaded.main_view() ).toBe( Viewer_3d );
	} );
} );

describe( 'falling back before mounting', () => {
	test( 'without Pixi: image stack, reported once for the page view', () => {
		const loaded = load( { config: { viewer_2d_renderer: 'canvas' }, pixi: null } );
		expect( loaded.main_view() ).toBe( Default_Viewer );
		expect( loaded.main_view() ).toBe( Default_Viewer );
		expect( loaded.fired ).toEqual( [ { reason: 'pixi_missing', detail: undefined } ] );
		expect( PC.fe.views.viewer_canvas.disabled ).toEqual( { reason: 'pixi_missing' } );
	} );

	test( 'without WebGL: image stack, and the webgl.unavailable action', () => {
		const loaded = load( { config: { viewer_2d_renderer: 'canvas' }, pixi: 'no-webgl' } );
		expect( loaded.main_view() ).toBe( Default_Viewer );
		expect( loaded.fired ).toEqual( [ { webgl_unavailable: true }, { reason: 'webgl', detail: undefined } ] );
	} );

	test( 'a layer drawn by a DOM item view: image stack for this product only, naming the layer', () => {
		const engraving = make_model( { id: 3, name: 'Engraving', admin_label: 'Engraving (front)' } );
		const loaded = load( {
			config: { viewer_2d_renderer: 'canvas' },
			layers: [ make_model( { id: 1, name: 'Case' } ), engraving ],
			contents: {
				1: make_collection( [ make_model( { id: 1, layer_type: 'simple' } ) ] ),
				3: make_collection( [ make_model( { id: 1, layer_type: 'text-overlay' } ) ] ),
			},
		} );
		const Overlay_View = function() {};
		loaded.hooks.addFilter( 'PC.fe.viewer.item.view', 'MKL/PC/TO', ( View, choice ) => ( 'text-overlay' === choice.get( 'layer_type' ) ? Overlay_View : View ) );

		expect( loaded.main_view() ).toBe( Default_Viewer );
		expect( loaded.fired ).toEqual( [ { reason: 'dom_item_view', detail: 'Engraving (front)' } ] );
		// Another product on the page may still use the canvas.
		expect( PC.fe.views.viewer_canvas.disabled ).toBeNull();
	} );

	test( 'once disabled at runtime, later mounts use the image stack without reporting again', () => {
		const loaded = load( { config: { viewer_2d_renderer: 'canvas' } } );
		PC.fe.views.viewer_canvas.disabled = { reason: 'cors', detail: 'https://cdn.example/a.png' };
		expect( loaded.main_view() ).toBe( Default_Viewer );
		expect( loaded.fired ).toEqual( [] );
	} );
} );

describe( 'unpremultiply()', () => {
	beforeAll( () => {
		global.ImageData = class {
			constructor( width, height ) {
				this.width = width;
				this.height = height;
				this.data = new Uint8ClampedArray( width * height * 4 );
			}
		};
	} );
	afterAll( () => {
		delete global.ImageData;
	} );

	test( 'restores straight alpha, keeps opaque and transparent pixels as they are', () => {
		load();
		const premultiplied = new Uint8ClampedArray( [
			58, 59, 58, 74, // 200, 203, 200 at alpha 74, as Pixi read it back
			10, 20, 30, 255, // opaque
			0, 0, 0, 0, // transparent
			128, 0, 64, 128, // half
		] );
		const image = PC.fe.views.viewer_canvas.prototype.unpremultiply( premultiplied, 4, 1 );
		expect( Array.from( image.data ) ).toEqual( [
			200, 203, 200, 74,
			10, 20, 30, 255,
			0, 0, 0, 0,
			255, 0, 128, 128,
		] );
	} );
} );

describe( 'texture scale steps', () => {
	test( 'rounds up to a step of √2, never above full size', () => {
		load();
		const step = PC.fe.views.viewer_canvas.scale_step;
		expect( step( 2 ) ).toBe( 1 );
		expect( step( 1 ) ).toBe( 1 );
		expect( step( 0.9 ) ).toBe( 1 );
		expect( step( 0.7 ) ).toBeCloseTo( Math.SQRT1_2 );
		expect( step( 0.5 ) ).toBe( 0.5 );
		expect( step( 0.49 ) ).toBe( 0.5 );
		// 3840 px shown 505 px wide: a 679 px texture.
		expect( step( 505 / 3840 ) * 3840 ).toBeCloseTo( 678.8, 0 );
		expect( step( 0 ) ).toBe( 1 );
		expect( step( NaN ) ).toBe( 1 );
	} );

	test( 'a texture never holds more than twice the pixels shown', () => {
		load();
		for ( let shown = 0.01; shown < 1; shown += 0.0137 ) {
			const scale = PC.fe.views.viewer_canvas.scale_step( shown );
			expect( scale ).toBeGreaterThanOrEqual( shown );
			expect( ( scale * scale ) / ( shown * shown ) ).toBeLessThanOrEqual( 2.0001 );
		}
	} );
} );

describe( 'eviction', () => {
	test( 'least recently used first, only until under budget', () => {
		load();
		const records = [
			{ id: 'a', bytes: 40, last_used: 3 },
			{ id: 'b', bytes: 40, last_used: 1 },
			{ id: 'c', bytes: 40, last_used: 2 },
		];
		const pick = ( total, budget ) => PC.fe.views.viewer_canvas.pick_evictions( records, total, budget ).map( ( r ) => r.id );
		expect( pick( 100, 100 ) ).toEqual( [] );
		expect( pick( 130, 100 ) ).toEqual( [ 'b' ] );
		expect( pick( 170, 100 ) ).toEqual( [ 'b', 'c' ] );
		// Still over with nothing left: everything unpinned goes, the rest stays.
		expect( pick( 500, 100 ) ).toEqual( [ 'b', 'c', 'a' ] );
	} );
} );

describe( 'responsive images and budget', () => {
	const choice = ( images ) => ( { get_image: ( name, key ) => images[ key ] } );
	const with_width = ( width ) => {
		const loaded = load( { config: { viewer_2d_renderer: 'canvas', mobile_image_breakpoint: 660, large_image_breakpoint: 2200 } } );
		PC.fe.modal = { $el: { outerWidth: () => width } };
		return loaded;
	};

	test( 'the same file the <img> stack picks at each width', () => {
		const all = choice( { url: 'full.png', url_mobile: 'small.png', url_large: 'large.png' } );
		const plain = choice( { url: 'full.png' } );
		const proto = () => PC.fe.views.viewer_canvas.prototype;

		with_width( 400 );
		expect( proto().image_url( all, 1 ) ).toBe( 'small.png' );
		expect( proto().image_url( plain, 1 ) ).toBe( 'full.png' );
		with_width( 1200 );
		expect( proto().image_url( all, 1 ) ).toBe( 'full.png' );
		with_width( 2400 );
		expect( proto().image_url( all, 1 ) ).toBe( 'large.png' );
		expect( proto().image_url( choice( {} ), 1 ) ).toBe( '' );
	} );

	test( '256 MB, 96 MB under the mobile breakpoint, filterable', () => {
		const loaded = with_width( 1200 );
		const budget = () => PC.fe.views.viewer_canvas.prototype.texture_budget.call( {} );
		expect( budget() ).toBe( 256 * 1024 * 1024 );
		PC.fe.modal.$el.outerWidth = () => 400;
		expect( budget() ).toBe( 96 * 1024 * 1024 );
		loaded.hooks.addFilter( 'PC.fe.viewer.canvas.texture_budget', 'test', () => 1234 );
		expect( budget() ).toBe( 1234 );
	} );
} );

describe( 'full-size decodes', () => {
	const with_width = ( width ) => {
		const loaded = load( { config: { viewer_2d_renderer: 'canvas', mobile_image_breakpoint: 660 } } );
		PC.fe.modal = { $el: { outerWidth: () => width } };
		return loaded;
	};

	test( '6 at once, 3 under the mobile breakpoint, filterable but never below 1', () => {
		const loaded = with_width( 1200 );
		const limit = () => PC.fe.views.viewer_canvas.prototype.decode_limit.call( {} );
		expect( limit() ).toBe( 6 );
		PC.fe.modal.$el.outerWidth = () => 400;
		expect( limit() ).toBe( 3 );
		loaded.hooks.addFilter( 'PC.fe.viewer.canvas.decode_limit', 'test', () => 0 );
		expect( limit() ).toBe( 1 );
		loaded.hooks.addFilter( 'PC.fe.viewer.canvas.decode_limit', 'test', () => '8' );
		expect( limit() ).toBe( 8 );
	} );

	test( 'slots are granted up to the limit, then first come first served', async () => {
		with_width( 1200 );
		const viewer = Object.assign( Object.create( PC.fe.views.viewer_canvas.prototype ), {
			decoding: 0,
			decode_queue: [],
			decode_limit: () => 2,
		} );
		const granted = [];
		const frees = {};
		const ask = ( name ) => viewer.decode_slot().then( ( free ) => {
			granted.push( name );
			frees[ name ] = free;
		} );
		const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

		[ 'a', 'b', 'c', 'd', 'e' ].forEach( ask );
		await flush();
		expect( granted ).toEqual( [ 'a', 'b' ] );
		expect( viewer.decoding ).toBe( 2 );

		frees.b();
		frees.b(); // freeing twice frees once
		await flush();
		expect( granted ).toEqual( [ 'a', 'b', 'c' ] );
		expect( viewer.decoding ).toBe( 2 );

		frees.a();
		frees.c();
		await flush();
		expect( granted ).toEqual( [ 'a', 'b', 'c', 'd', 'e' ] );
		frees.d();
		frees.e();
		expect( viewer.decoding ).toBe( 0 );
		expect( viewer.decode_queue ).toEqual( [] );
	} );
} );

describe( 'pinning', () => {
	test( 'a texture an entry of the shown or next picture waits for is pinned, others are not', () => {
		load();
		global._ = { find: ( list, callback ) => ( list || [] ).find( callback ) };
		const current = {};
		const target = {};
		const other = {};
		const viewer = Object.assign( Object.create( PC.fe.views.viewer_canvas.prototype ), {
			current_stack: current,
			target_stack: target,
			waiting: { 'a.png': [ { stack: target } ], 'b.png': [ { stack: other } ] },
		} );
		const pinned = ( url, entries = [] ) => viewer.is_pinned( { url, entries } );
		expect( pinned( 'a.png' ) ).toBe( true );
		expect( pinned( 'b.png' ) ).toBe( false );
		expect( pinned( 'c.png' ) ).toBe( false );
		expect( pinned( 'c.png', [ { stack: current } ] ) ).toBe( true );
		delete global._;
	} );
} );

describe( 'abandoned decodes', () => {
	test( 'a waiter nobody wants when its turn comes gives its slot to the next', async () => {
		load();
		const viewer = Object.assign( Object.create( PC.fe.views.viewer_canvas.prototype ), {
			decoding: 0,
			decode_queue: [],
			decode_limit: () => 1,
		} );
		const wanted = { a: true, b: true, c: true, d: true };
		const outcome = {};
		const frees = {};
		const ask = ( name ) => viewer.decode_slot( () => wanted[ name ] ).then( ( free ) => {
			outcome[ name ] = free ? 'granted' : 'abandoned';
			frees[ name ] = free;
		} );
		const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

		[ 'a', 'b', 'c', 'd' ].forEach( ask );
		await flush();
		expect( outcome ).toEqual( { a: 'granted' } );

		// The angle b and c were loading for was left before their turn.
		wanted.b = false;
		wanted.c = false;
		frees.a();
		await flush();
		expect( outcome ).toEqual( { a: 'granted', b: 'abandoned', c: 'abandoned', d: 'granted' } );
		expect( viewer.decoding ).toBe( 1 );
		frees.d();
		expect( viewer.decoding ).toBe( 0 );
	} );

	test( 'the first waiter is granted straight away when a slot is free', async () => {
		load();
		const viewer = Object.assign( Object.create( PC.fe.views.viewer_canvas.prototype ), {
			decoding: 0,
			decode_queue: [],
			decode_limit: () => 1,
		} );
		const free = await viewer.decode_slot( () => false );
		expect( typeof free ).toBe( 'function' );
	} );
} );

describe( 'sharing a load that is given up', () => {
	test( 'a caller that still wants the image loads it again; one that does not gets abandoned', async () => {
		load();
		global._ = { find: ( list, callback ) => ( list || [] ).find( callback ) };
		const abandoned = PC.fe.views.viewer_canvas.abandoned;
		const fetches = [];
		const viewer = Object.assign( Object.create( PC.fe.views.viewer_canvas.prototype ), {
			textures: {},
			is_removed: false,
			texture_scale: () => 1,
			touch: () => {},
			set_texture: ( record, built, scale ) => Object.assign( record, { texture: built.texture, scale, bytes: 4 } ),
			destroy_built: () => {},
			fetch_texture( url, scale_for, wanted ) {
				return new Promise( ( resolve ) => fetches.push( { wanted, resolve } ) );
			},
		} );
		let second_wants = false;
		const first = viewer.load_texture( 'a.png', {}, () => false );
		const second = viewer.load_texture( 'a.png', {}, () => second_wants );
		expect( fetches ).toHaveLength( 1 );
		// Neither wants it when the slot comes: given up.
		expect( fetches[ 0 ].wanted() ).toBe( false );
		fetches[ 0 ].resolve( abandoned );
		// The customer comes back to the second caller's angle meanwhile.
		second_wants = true;
		await expect( first ).resolves.toBe( abandoned );
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
		expect( fetches ).toHaveLength( 2 );
		fetches[ 1 ].resolve( { built: { texture: 'T' }, natural: { width: 1, height: 1 }, scale: 1 } );
		const record = await second;
		expect( record.texture ).toBe( 'T' );
		expect( viewer.textures[ 'a.png' ] ).toBe( record );
		delete global._;
	} );
} );
