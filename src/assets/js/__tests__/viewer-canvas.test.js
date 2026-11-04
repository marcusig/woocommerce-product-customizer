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
