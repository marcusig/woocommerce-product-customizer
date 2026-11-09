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

	test( 'a device reporting little memory only ever lowers the budget', () => {
		const MiB = 1024 * 1024;
		const set_memory = ( value ) => Object.defineProperty( window.navigator, 'deviceMemory', { value, configurable: true } );
		const loaded = with_width( 1200 );
		const budget = () => PC.fe.views.viewer_canvas.prototype.texture_budget.call( {} );
		try {
			set_memory( 8 );
			expect( budget() ).toBe( 256 * MiB );
			set_memory( 4 );
			expect( budget() ).toBe( 128 * MiB );
			set_memory( 2 );
			expect( budget() ).toBe( 64 * MiB );
			set_memory( 0.5 );
			expect( budget() ).toBe( 64 * MiB );
			// Under the breakpoint, 4 GB keeps the smaller mobile budget.
			PC.fe.modal.$el.outerWidth = () => 400;
			set_memory( 4 );
			expect( budget() ).toBe( 96 * MiB );
			set_memory( 1 );
			expect( budget() ).toBe( 64 * MiB );
			// The filter still has the last word.
			loaded.hooks.addFilter( 'PC.fe.viewer.canvas.texture_budget', 'test', () => 1234 );
			expect( budget() ).toBe( 1234 );
		} finally {
			delete window.navigator.deviceMemory;
		}
		expect( PC.fe.views.viewer_canvas.memory_cap() ).toBe( 0 );
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
		global._ = { find: ( list, callback ) => ( list || [] ).find( callback ), contains: ( list, item ) => list.includes( item ) };
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
		// Covered by its flat copy, the outgoing angle no longer holds its textures...
		viewer.cover = { angle_id: 1 };
		expect( pinned( 'c.png', [ { stack: current } ] ) ).toBe( false );
		expect( pinned( 'a.png' ) ).toBe( true );
		// ...unless a transition is drawing it live.
		viewer.transition = { from: { stack: current }, to: { cover: viewer.cover } };
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

describe( 'decode priority', () => {
	test( 'a freed slot goes to the shown picture before background work, in order within each', async () => {
		load();
		const viewer = Object.assign( Object.create( PC.fe.views.viewer_canvas.prototype ), {
			decoding: 0,
			decode_queue: [],
			decode_limit: () => 1,
		} );
		const order = [];
		const frees = {};
		const ask = ( name, background ) => viewer.decode_slot( () => true, () => background ).then( ( free ) => {
			order.push( name );
			frees[ name ] = free;
		} );
		const flush = () => new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

		ask( 'shown', false );
		ask( 'other angle 1', true );
		ask( 'other angle 2', true );
		ask( 'new choice', false );
		await flush();
		expect( order ).toEqual( [ 'shown' ] );
		frees.shown();
		await flush();
		// The customer's new choice jumps the background queue.
		expect( order ).toEqual( [ 'shown', 'new choice' ] );
		frees[ 'new choice' ]();
		await flush();
		frees[ 'other angle 1' ]();
		await flush();
		expect( order ).toEqual( [ 'shown', 'new choice', 'other angle 1', 'other angle 2' ] );
	} );
} );

describe( 'how other angles are kept', () => {
	const MiB = 1024 * 1024;
	const viewer_with = ( { picture, angles, budget, mode = 'refresh', blocked = false } ) => {
		load();
		global._ = { size: ( object ) => Object.keys( object ).length };
		const stacks = {};
		for ( let i = 0; i < angles; i++ ) stacks[ i ] = {};
		return Object.assign( Object.create( PC.fe.views.viewer_canvas.prototype ), {
			stacks,
			current_stack: null,
			picture_bytes: picture * MiB,
			mode,
			live_blocked: blocked,
			texture_budget: () => budget * MiB,
		} );
	};
	afterEach( () => {
		delete global._;
	} );

	test( 'live while every visited angle fits in 75% of the budget', () => {
		// 7860: 2 MiB a picture.
		expect( viewer_with( { picture: 2, angles: 4, budget: 96 } ).update_mode() ).toBe( 'live' );
		// 7861 on desktop: 30 MiB × 4 against 256.
		expect( viewer_with( { picture: 30, angles: 4, budget: 256 } ).update_mode() ).toBe( 'live' );
		// 7861 on a phone: 59 MiB × 4 against 96 - refreshed snapshots instead.
		expect( viewer_with( { picture: 59, angles: 4, budget: 96 } ).update_mode() ).toBe( 'refresh' );
		// 7859 on a phone: one picture alone is over budget.
		expect( viewer_with( { picture: 296, angles: 4, budget: 96 } ).update_mode() ).toBe( 'reload' );
	} );

	test( 'hysteresis: once live, it stays live up to the whole budget', () => {
		// 200 MiB of 256: 78%, above the 75% to start...
		expect( viewer_with( { picture: 50, angles: 4, budget: 256 } ).update_mode() ).toBe( 'refresh' );
		// ...but not enough to stop.
		expect( viewer_with( { picture: 50, angles: 4, budget: 256, mode: 'live' } ).update_mode() ).toBe( 'live' );
		expect( viewer_with( { picture: 70, angles: 4, budget: 256, mode: 'live' } ).update_mode() ).toBe( 'refresh' );
	} );

	test( 'an eviction blocks live mode; nothing measured keeps the mode; a filter has the last word', () => {
		expect( viewer_with( { picture: 2, angles: 4, budget: 96, blocked: true } ).update_mode() ).toBe( 'refresh' );
		expect( viewer_with( { picture: 0, angles: 4, budget: 96, mode: 'live' } ).update_mode() ).toBe( 'live' );
		const viewer = viewer_with( { picture: 2, angles: 4, budget: 96 } );
		wp.hooks.addFilter( 'PC.fe.viewer.canvas.views_mode', 'test', () => 'reload' );
		expect( viewer.update_mode() ).toBe( 'reload' );
		wp.hooks.addFilter( 'PC.fe.viewer.canvas.views_mode', 'test', () => 'nonsense' );
		expect( viewer.update_mode() ).toBe( 'refresh' );
	} );
} );

describe( 'freeing images after upload', () => {
	const viewer_with = ( { lost = false, init_throws = false } = {} ) => {
		const uploaded = [];
		const viewer = Object.assign( Object.create( PC.fe.views.viewer_canvas.prototype ), {
			app: {
				renderer: {
					gl: { isContextLost: () => lost },
					texture: {
						initSource: ( source ) => {
							if ( init_throws ) throw new Error( 'no' );
							uploaded.push( source );
						},
					},
				},
			},
		} );
		return { viewer, uploaded };
	};
	const built_with = ( resource ) => ( { texture: { source: { resource } } } );

	test( 'uploads first, then closes a bitmap, empties a canvas, unloads an image', () => {
		load();
		const { viewer, uploaded } = viewer_with();
		const bitmap = { close: jest.fn() };
		const built = built_with( bitmap );
		expect( viewer.free_source( built ) ).toBe( true );
		expect( uploaded ).toEqual( [ built.texture.source ] );
		expect( bitmap.close ).toHaveBeenCalled();

		const canvas = document.createElement( 'canvas' );
		canvas.width = 960;
		canvas.height = 540;
		expect( viewer.free_source( built_with( canvas ) ) ).toBe( true );
		expect( [ canvas.width, canvas.height ] ).toEqual( [ 0, 0 ] );

		const image = document.createElement( 'img' );
		image.setAttribute( 'src', 'a.png' );
		expect( viewer.free_source( built_with( image ) ) ).toBe( true );
		expect( image.hasAttribute( 'src' ) ).toBe( false );
	} );

	test( 'keeps the image when there is nothing to upload to, or the upload fails', () => {
		load();
		const bitmap = { close: jest.fn() };
		expect( viewer_with( { lost: true } ).viewer.free_source( built_with( bitmap ) ) ).toBe( false );
		expect( viewer_with( { init_throws: true } ).viewer.free_source( built_with( bitmap ) ) ).toBe( false );
		expect( bitmap.close ).not.toHaveBeenCalled();
	} );

	test( 'a restored context drops every texture and loads the angles on screen again', () => {
		load();
		global._ = {
			each: ( list, callback, context ) => Object.keys( list || {} ).forEach( ( key ) => callback.call( context, list[ key ], key ) ),
			values: ( object ) => Object.values( object || {} ),
		};
		const synced = [];
		const destroyed = [];
		const dropped = [];
		const shown = { key: 'x' };
		const current = { layers: { 1: { shown: { x: shown }, held: [] } } };
		const other = { layers: { 1: { shown: { y: { key: 'y' } }, held: [] } } };
		const viewer = Object.assign( Object.create( PC.fe.views.viewer_canvas.prototype ), {
			stacks: { 1: current, 2: other },
			current_stack: current,
			target_stack: current,
			textures: { 'a.png': { url: 'a.png' }, 'b.png': { url: 'b.png' } },
			live_blocked: true,
			stop_background: () => {},
			stop_refresh: () => {},
			drop_held: () => {},
			drop_entry: ( entry ) => dropped.push( entry.key ),
			destroy_record: ( record ) => destroyed.push( record.url ),
			sync_stack: ( stack ) => synced.push( stack ),
			after_change: () => {},
		} );
		viewer.reload_textures();
		expect( dropped.sort() ).toEqual( [ 'x', 'y' ] );
		expect( destroyed.sort() ).toEqual( [ 'a.png', 'b.png' ] );
		expect( viewer.textures ).toEqual( {} );
		expect( current.layers[ 1 ].shown ).toEqual( {} );
		expect( other.layers[ 1 ].shown ).toEqual( {} );
		// Only the angle on screen loads now; the others when shown.
		expect( synced ).toEqual( [ current ] );
		expect( viewer.live_blocked ).toBe( false );
		delete global._;
	} );
} );

describe( 'image decoder switch', () => {
	afterEach( () => {
		delete window.createImageBitmap;
	} );

	const viewer = () => Object.create( PC.fe.views.viewer_canvas.prototype );

	test( '<img> by default; blob only when asked and supported', () => {
		load();
		window.fetch = window.fetch || ( () => {} );
		URL.createObjectURL = URL.createObjectURL || ( () => '' );
		expect( viewer().image_decoder() ).toBe( 'element' );
		wp.hooks.addFilter( 'PC.fe.viewer.canvas.image_decoder', 'test', () => 'blob' );
		// No createImageBitmap (jsdom): stays on <img>.
		expect( viewer().image_decoder() ).toBe( 'element' );
		window.createImageBitmap = () => Promise.resolve();
		expect( viewer().image_decoder() ).toBe( 'blob' );
		wp.hooks.addFilter( 'PC.fe.viewer.canvas.image_decoder', 'test', () => 'nonsense' );
		expect( viewer().image_decoder() ).toBe( 'element' );
	} );

	test( 'resized as it decodes; drawn smaller when the browser ignores the resize', async () => {
		load();
		global.PIXI.Texture = function( options ) {
			this.source = options.source;
		};
		global.PIXI.ImageSource = function( options ) {
			this.resource = options.resource;
		};
		const calls = [];
		const close = jest.fn();
		let ignore_resize = false;
		window.createImageBitmap = ( blob, options ) => {
			calls.push( options );
			return Promise.resolve( ignore_resize ? { width: 400, height: 200, close } : { width: options.resizeWidth, height: options.resizeHeight, close } );
		};
		const v = Object.assign( viewer(), { downscale: ( bitmap, width, height ) => ( { canvas: true, width, height } ) } );
		const built = await v.build_bitmap( 'blob', { width: 400, height: 200 }, 0.5 );
		expect( calls[ 0 ] ).toEqual( { premultiplyAlpha: 'premultiply', resizeWidth: 200, resizeHeight: 100, resizeQuality: 'high' } );
		expect( built.bitmap.width ).toBe( 200 );
		expect( built.texture.source.resource ).toBe( built.bitmap );

		ignore_resize = true;
		const drawn = await v.build_bitmap( 'blob', { width: 400, height: 200 }, 0.5 );
		expect( close ).toHaveBeenCalled();
		expect( drawn.bitmap ).toBe( null );
		expect( drawn.texture.source.resource ).toEqual( { canvas: true, width: 200, height: 100 } );

		// Full size: no resize options at all.
		ignore_resize = false;
		calls.length = 0;
		window.createImageBitmap = ( blob, options ) => {
			calls.push( options );
			return Promise.resolve( { width: 400, height: 200, close } );
		};
		await v.build_bitmap( 'blob', { width: 400, height: 200 }, 1 );
		expect( calls[ 0 ] ).toEqual( { premultiplyAlpha: 'premultiply' } );
	} );

	test( 'a file createImageBitmap cannot decode goes through <img>, after freeing its slot', async () => {
		load();
		const freed = jest.fn();
		const element = jest.fn( () => Promise.resolve( 'from element' ) );
		const v = Object.assign( viewer(), {
			is_removed: false,
			load_blob: () => Promise.resolve( { blob: 'svg', natural: { width: 10, height: 10 } } ),
			decode_slot: () => Promise.resolve( freed ),
			build_bitmap: () => Promise.reject( new Error( 'cannot decode' ) ),
			fetch_element: element,
		} );
		const wanted = () => true;
		await expect( v.fetch_bitmap( 'a.svg', () => 1, wanted ) ).resolves.toBe( 'from element' );
		expect( freed ).toHaveBeenCalled();
		expect( element ).toHaveBeenCalledWith( 'a.svg', expect.any( Function ), wanted, undefined );
	} );

	test( 'a load nobody wants any more gives up its slot before decoding', async () => {
		load();
		const build = jest.fn();
		const v = Object.assign( viewer(), {
			load_blob: () => Promise.resolve( { blob: 'b', natural: { width: 10, height: 10 } } ),
			decode_slot: () => Promise.resolve( null ),
			build_bitmap: build,
		} );
		await expect( v.fetch_bitmap( 'a.png', () => 1, () => false ) ).resolves.toBe( PC.fe.views.viewer_canvas.abandoned );
		expect( build ).not.toHaveBeenCalled();
	} );
} );

describe( 'add-on items (PC.fe.viewer.canvas.item)', () => {
	/** The underscore functions the item code uses. */
	const underscore = {
		each: ( list, callback, context ) => {
			if ( Array.isArray( list ) ) list.forEach( ( value, index ) => callback.call( context, value, index ) );
			else Object.keys( list || {} ).forEach( ( key ) => callback.call( context, list[ key ], key ) );
		},
		map: ( list, callback, context ) => list.map( ( value ) => callback.call( context, value ) ),
		find: ( list, callback ) => ( list || [] ).find( callback ),
		values: ( object ) => Object.values( object ),
		compact: ( list ) => list.filter( Boolean ),
		contains: ( list, item ) => list.includes( item ),
		without: ( list, item ) => list.filter( ( value ) => value !== item ),
		keys: ( object ) => Object.keys( object ),
	};
	const text_choice = () => make_model( { id: 1, layerId: 3, layer_type: 'text-overlay' } );
	const image_choice = ( id, url ) => Object.assign( make_model( { id, layerId: 1 } ), { url } );
	const item_for_text = ( item ) => ( current, choice ) => ( 'text-overlay' === choice.get( 'layer_type' ) ? item : current );

	beforeEach( () => {
		global._ = underscore;
	} );
	afterEach( () => {
		delete global._;
	} );

	test( 'a DOM item view with a canvas item keeps the canvas; an item without create() does not count', () => {
		const loaded = load( {
			config: { viewer_2d_renderer: 'canvas' },
			layers: [ make_model( { id: 3, name: 'Engraving' } ) ],
			contents: { 3: make_collection( [ text_choice() ] ) },
		} );
		const Overlay_View = function() {};
		loaded.hooks.addFilter( 'PC.fe.viewer.item.view', 'MKL/PC/TO', ( View, choice ) => ( 'text-overlay' === choice.get( 'layer_type' ) ? Overlay_View : View ) );
		const asked = [];
		loaded.hooks.addFilter( 'PC.fe.viewer.canvas.item', 'MKL/PC/TO', ( item, choice, context ) => {
			asked.push( context );
			return item_for_text( { create: () => null } )( item, choice );
		} );
		expect( loaded.main_view() ).toBe( PC.fe.views.viewer_canvas );
		expect( loaded.fired ).toEqual( [] );
		// Only asking: no viewer yet.
		expect( asked[ 0 ].viewer ).toBeNull();

		loaded.hooks.addFilter( 'PC.fe.viewer.canvas.item', 'MKL/PC/TO', item_for_text( { update: () => {} } ) );
		expect( loaded.main_view() ).toBe( Default_Viewer );
		expect( loaded.fired ).toEqual( [ { reason: 'dom_item_view', detail: 'Engraving' } ] );
	} );

	function make_viewer( hooks ) {
		const statics = PC.fe.views.viewer_canvas;
		PC.fe.viewer_state = { has_drawable: ( choice ) => !! choice.url };
		PC.fe.layers.get = () => null;
		return Object.assign( Object.create( statics.prototype ), {
			items: {},
			dirty_items: [],
			stacks: {},
			app: { renderer: { resolution: 2 } },
			image_url: ( choice ) => choice.url || '',
			hooks,
		} );
	}

	test( 'the picture lists items by key, so a change of what an item draws makes flat copies stale', () => {
		const loaded = load();
		const viewer = make_viewer( loaded.hooks );
		let text = 'Hello';
		loaded.hooks.addFilter( 'PC.fe.viewer.canvas.item', 'test', item_for_text( { create: () => null, key: ( angle_id ) => angle_id + ':' + text } ) );
		const choices = [ image_choice( 1, 'case.png' ), text_choice(), make_model( { id: 2, layerId: 1 } ) ];
		const parts = viewer.parts_of( choices, 7 );
		expect( parts.map( ( part ) => part.url || part.key ) ).toEqual( [ 'case.png', 'item:3:1:7:Hello' ] );

		viewer.ordered_choices = () => choices;
		const before = viewer.picture_key( { angle_id: 7 } );
		text = 'Hello!';
		expect( viewer.picture_key( { angle_id: 7 } ) ).not.toBe( before );
		// Asked once per choice and viewer.
		expect( Object.keys( viewer.items ) ).toEqual( [ '1:1', '3:1', '1:2' ] );
	} );

	test( 'an entry waits for ready(), then its container joins the layer node; nothing at the angle still settles', async () => {
		const loaded = load();
		const viewer = make_viewer( loaded.hooks );
		viewer.release_held = jest.fn();
		viewer.after_change = jest.fn();
		let resolve_ready;
		const container = { zIndex: 0 };
		const item = {
			ready: () => new Promise( ( resolve ) => { resolve_ready = resolve; } ),
			create: jest.fn( () => container ),
		};
		const node = { children: [], addChild( child ) { this.children.push( child ); } };
		const stack = { angle_id: 4, size: { width: 800, height: 600 }, container: { scale: { x: 0.5 } } };
		const entry = { item, index: 2, settled: false, removed: false, sprite: null };
		viewer.load_entry( stack, { node }, entry );
		expect( entry.settled ).toBe( false );
		expect( item.create ).not.toHaveBeenCalled();

		resolve_ready();
		await Promise.resolve();
		expect( item.create ).toHaveBeenCalledWith( 4, { size: stack.size, resolution: 1, capture: false } );
		expect( node.children ).toEqual( [ container ] );
		expect( container.zIndex ).toBe( 2 );
		expect( entry ).toMatchObject( { settled: true, sprite: container } );

		const nothing = { item: { create: () => null }, index: 0, settled: false, sprite: null };
		viewer.load_entry( stack, { node }, nothing );
		expect( nothing ).toMatchObject( { settled: true, sprite: null } );
	} );

	test( 'request_render() updates every container of that item once, before the next frame', () => {
		const loaded = load();
		const viewer = make_viewer( loaded.hooks );
		viewer.note_activity = jest.fn();
		viewer.after_change = jest.fn();
		const changed = { create: () => ( {} ), update: jest.fn() };
		const other = { create: () => ( {} ), update: jest.fn() };
		const stack = ( angle_id, entries ) => ( { angle_id, size: null, container: { scale: { x: 1 } }, layers: { 3: { shown: entries } } } );
		viewer.stacks = {
			1: stack( 1, { a: { item: changed, sprite: 'c1' }, b: { item: other, sprite: 'c2' } } ),
			2: stack( 2, { a: { item: changed, sprite: 'c3' }, c: { url: 'x.png', sprite: 's' } } ),
		};
		viewer.items[ '3:1' ] = changed;
		viewer.item_context( text_choice() ).request_render();
		viewer.item_context( text_choice() ).request_render();
		expect( viewer.dirty_items ).toEqual( [ changed ] );
		expect( viewer.background_dirty ).toBe( true );
		expect( viewer.after_change ).toHaveBeenCalled();

		viewer.apply_item_updates();
		expect( changed.update.mock.calls.map( ( call ) => [ call[ 0 ], call[ 1 ] ] ) ).toEqual( [ [ 'c1', 1 ], [ 'c3', 2 ] ] );
		expect( other.update ).not.toHaveBeenCalled();
		viewer.apply_item_updates();
		expect( changed.update ).toHaveBeenCalledTimes( 2 );
	} );

	test( 'one-off drawings wait for ready(), draw anyway when it fails, and survive a throwing create()', async () => {
		load();
		const statics = PC.fe.views.viewer_canvas;
		const container = {};
		await expect( statics.draw_item_once( { ready: () => Promise.reject( new Error( 'font' ) ), create: () => container }, 1, {} ) )
			.resolves.toMatchObject( { container } );
		await expect( statics.draw_item_once( { create: () => { throw new Error( 'bug' ); } }, 1, {} ) )
			.resolves.toMatchObject( { container: null } );
	} );

	test( 'a container leaves through destroy_container(), with its children', () => {
		load();
		const order = [];
		const parent = { removeChild: () => order.push( 'removed' ) };
		const container = { parent, destroyed: false, destroy: ( options ) => order.push( [ 'destroy', options ] ) };
		PC.fe.views.viewer_canvas.destroy_item_container( { destroy_container: () => order.push( 'item' ) }, container );
		expect( order ).toEqual( [ 'item', 'removed', [ 'destroy', { children: true } ] ] );
	} );
} );

describe( 'layer masks (docs/layer-masks-spec.md)', () => {
	const underscore = {
		each: ( list, callback, context ) => {
			if ( Array.isArray( list ) ) list.forEach( ( value, index ) => callback.call( context, value, index ) );
			else Object.keys( list || {} ).forEach( ( key ) => callback.call( context, list[ key ], key ) );
		},
		map: ( list, callback, context ) => list.map( ( value ) => callback.call( context, value ) ),
		find: ( list, callback, context ) => ( Array.isArray( list ) ? list : Object.values( list || {} ) ).find( ( value ) => callback.call( context, value ) ),
		filter: ( list, callback ) => list.filter( callback ),
		values: ( object ) => Object.values( object || {} ),
		isArray: Array.isArray,
		reject: ( list, callback ) => list.filter( ( item ) => ! callback( item ) ),
		without: ( list, item ) => list.filter( ( value ) => value !== item ),
		contains: ( list, item ) => list.includes( item ),
	};

	beforeEach( () => {
		global._ = underscore;
	} );
	afterEach( () => {
		delete global._;
	} );

	test( 'a mask texture has its own key: same file, no shared texture', () => {
		load();
		const statics = PC.fe.views.viewer_canvas;
		expect( statics.mask_key( 'https://shop.test/case.png' ) ).toBe( 'https://shop.test/case.png#pc-mask' );
		expect( statics.is_mask_key( statics.mask_key( 'case.png' ) ) ).toBe( true );
		expect( statics.is_mask_key( 'case.png' ) ).toBe( false );
	} );

	test( 'a layer waiting for its mask keeps the picture loading; a failed one does not', () => {
		load();
		const viewer = Object.create( PC.fe.views.viewer_canvas.prototype );
		const settled = { settled: true };
		const stack = { layers: { 3: { shown: { a: settled }, held: [], mask: { done: false } } } };
		expect( viewer.is_stack_settled( stack ) ).toBe( false );
		expect( viewer.count_loading( stack ) ).toBe( 1 );
		stack.layers[ 3 ].mask = { done: true, failed: true };
		expect( viewer.is_stack_settled( stack ) ).toBe( true );
		expect( viewer.count_loading( stack ) ).toBe( 0 );
		// Given up while its angle was not shown: still pending, loaded again when shown.
		stack.layers[ 3 ].mask = { done: false, abandoned: true };
		expect( viewer.is_stack_settled( stack ) ).toBe( false );
	} );

	test( 'the picture key names each image\'s mask, so a mask change makes snapshots stale', () => {
		load();
		const viewer = Object.create( PC.fe.views.viewer_canvas.prototype );
		let masks = [ { angleId: 1, image: { url: 'mask-a.png' } } ];
		const layer = { get: ( key ) => ( 'masks' === key ? masks : undefined ) };
		PC.fe.layers.get = () => layer;
		PC.fe.viewer_state = { has_drawable: () => true };
		PC.fe.layer_masks = {
			get: ( l, angle_id ) => {
				const mask = ( l.get( 'masks' ) || [] ).find( ( item ) => String( item.angleId ) === String( angle_id ) );
				return mask ? mask.image : null;
			},
		};
		viewer.items = {};
		viewer.canvas_item = () => null;
		viewer.image_url = ( choice ) => choice.url;
		const choice = Object.assign( make_model( { id: 1, layerId: 3 } ), { url: 'fabric.png' } );
		viewer.ordered_choices = () => [ choice ];

		expect( viewer.parts_of( [ choice ], 1 ) ).toEqual( [ { url: 'fabric.png', mask: 'mask-a.png' } ] );
		expect( viewer.parts_of( [ choice ], 2 ) ).toEqual( [ { url: 'fabric.png' } ] );
		const before = viewer.picture_key( { angle_id: 1 } );
		expect( before ).toBe( 'fabric.png mask:mask-a.png' );
		masks = [ { angleId: 1, image: { url: 'mask-b.png' } } ];
		expect( viewer.picture_key( { angle_id: 1 } ) ).not.toBe( before );
	} );

	test( 'one image: the node is masked; several: each sprite, with no stray mask sprites', () => {
		load();
		const made = [];
		global.PIXI.Sprite = function( texture ) {
			this.texture = texture;
			this.parent = null;
			this.destroyed = false;
			this.scale = { set: () => {} };
			this.position = { set: () => {} };
			this.destroy = () => {
				this.destroyed = true;
			};
			made.push( this );
		};
		const viewer = Object.create( PC.fe.views.viewer_canvas.prototype );
		viewer.request_render = () => {};
		viewer.fit_sprite = () => {};
		const node = {
			children: [],
			mask: null,
			addChild( child ) {
				child.parent = this;
				this.children.push( child );
			},
			removeChild( child ) {
				this.children = this.children.filter( ( item ) => item !== child );
				child.parent = null;
			},
		};
		const texture = { id: 'mask-texture' };
		const texture_record = { texture, natural: { width: 10, height: 10 }, destroyed: false };
		const a = { sprite: { mask: null } };
		const b = { sprite: { mask: null } };
		const record = { node, shown: { a }, held: [], mask: { done: true, texture_record } };
		const stack = { size: { width: 10, height: 10 } };

		viewer.apply_mask( stack, record );
		expect( node.mask ).toBe( record.mask_sprite );
		expect( a.sprite.mask ).toBeNull();

		record.shown.b = b;
		viewer.apply_mask( stack, record );
		expect( node.mask ).toBeNull();
		expect( a.sprite.mask ).toBe( a.mask_sprite );
		expect( b.sprite.mask ).toBe( b.mask_sprite );
		expect( a.mask_sprite ).not.toBe( b.mask_sprite );
		expect( node.children ).toEqual( [ a.mask_sprite, b.mask_sprite ] );

		delete record.shown.b;
		viewer.apply_mask( stack, record );
		expect( node.mask ).toBe( record.mask_sprite );
		expect( a.sprite.mask ).toBeNull();
		// b's mask sprite goes with b (drop_entry); a's own one is gone.
		expect( node.children ).toEqual( [ b.mask_sprite, record.mask_sprite ] );
		expect( a.mask_sprite ).toBeNull();

		// A failed mask: everything unmasked.
		record.mask = { done: true, failed: true, texture_record: null };
		viewer.apply_mask( stack, record );
		expect( node.mask ).toBeNull();
		expect( record.mask_sprite ).toBeNull();
	} );
} );
