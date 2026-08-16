/**
 * Tests for the pure helpers in 3d-scene-utils.
 *
 * These are the functions with no Three.js scene, no DOM and no WordPress
 * behind them — data in, data out — and they are also the ones that have
 * actually drifted in practice. The admin preview once carried its own copy of
 * the environment resolution and treated a cubemap with a missing face as
 * valid, because the emptiness check compared against null while a missing face
 * reads as undefined. That is the class of bug these cover.
 */
import {
	getHiddenObjectNamesList,
	getOrbitLimitsFromEnv,
	getHdrUrlFromEnv,
	getDefaultHdrPresetFilename,
	findObjectByCompositeId,
	findObject,
	getPixelRatio,
	MAX_PIXEL_RATIO,
} from '../3d-scene-utils.js';

const DEG = Math.PI / 180;

describe( 'getHiddenObjectNamesList', () => {
	it( 'merges PHP defaults with the merchant textarea', () => {
		expect( getHiddenObjectNamesList( [ 'product_bounding_box' ], 'bolt\nnut' ) )
			.toEqual( [ 'product_bounding_box', 'bolt', 'nut' ] );
	} );

	it( 'trims, drops blanks and de-duplicates against the defaults', () => {
		expect( getHiddenObjectNamesList(
			[ 'product_bounding_box' ],
			'  bolt  \n\n\n product_bounding_box \n'
		) ).toEqual( [ 'product_bounding_box', 'bolt' ] );
	} );

	it( 'copes with either side being absent', () => {
		expect( getHiddenObjectNamesList( null, '' ) ).toEqual( [] );
		expect( getHiddenObjectNamesList( undefined, 'solo' ) ).toEqual( [ 'solo' ] );
		expect( getHiddenObjectNamesList( [ 'only' ], undefined ) ).toEqual( [ 'only' ] );
	} );

	it( 'splits on CR, LF and CRLF alike', () => {
		expect( getHiddenObjectNamesList( [], 'a\r\nb\rc\nd' ) ).toEqual( [ 'a', 'b', 'c', 'd' ] );
	} );
} );

describe( 'getOrbitLimitsFromEnv', () => {
	it( 'converts degrees to radians', () => {
		const limits = getOrbitLimitsFromEnv( {
			orbit_min_polar_angle: 30,
			orbit_max_polar_angle: 60,
			orbit_min_azimuth_angle: -90,
			orbit_max_azimuth_angle: 90,
		} );
		expect( limits.minPolarAngle ).toBeCloseTo( 30 * DEG );
		expect( limits.maxPolarAngle ).toBeCloseTo( 60 * DEG );
		expect( limits.minAzimuthAngle ).toBeCloseTo( -90 * DEG );
		expect( limits.maxAzimuthAngle ).toBeCloseTo( 90 * DEG );
	} );

	it( 'defaults to a top hemisphere and a full turn', () => {
		const limits = getOrbitLimitsFromEnv( {} );
		expect( limits.minPolarAngle ).toBe( 0 );
		expect( limits.maxPolarAngle ).toBeCloseTo( 90 * DEG );
		expect( limits.minAzimuthAngle ).toBeCloseTo( -180 * DEG );
		expect( limits.maxAzimuthAngle ).toBeCloseTo( 180 * DEG );
	} );

	it( 'applies zoom limits unless the toggle is explicitly false', () => {
		const env = { orbit_min_distance: 2, orbit_max_distance: 8 };
		expect( getOrbitLimitsFromEnv( env ) ).toMatchObject( { minDistance: 2, maxDistance: 8 } );
		expect( getOrbitLimitsFromEnv( { ...env, orbit_zoom_limits_enabled: true } ) )
			.toMatchObject( { minDistance: 2, maxDistance: 8 } );
		expect( getOrbitLimitsFromEnv( { ...env, orbit_zoom_limits_enabled: false } ) )
			.toMatchObject( { minDistance: 0, maxDistance: Infinity } );
	} );

	it( 'ignores non-positive or non-numeric distances', () => {
		expect( getOrbitLimitsFromEnv( { orbit_min_distance: 0, orbit_max_distance: -5 } ) )
			.toMatchObject( { minDistance: 0, maxDistance: Infinity } );
		expect( getOrbitLimitsFromEnv( { orbit_min_distance: '2', orbit_max_distance: '8' } ) )
			.toMatchObject( { minDistance: 0, maxDistance: Infinity } );
	} );

	it( 'survives a null env', () => {
		expect( getOrbitLimitsFromEnv( null ) ).toMatchObject( { minDistance: 0, maxDistance: Infinity } );
	} );
} );

describe( 'getHdrUrlFromEnv', () => {
	const BASE = 'https://example.test/hdr/';
	const outdoor = BASE + getDefaultHdrPresetFilename( 'outdoor' );
	const studio = BASE + getDefaultHdrPresetFilename( 'studio' );

	it( 'returns nothing for mode "none" — an unlit or fully baked scene', () => {
		expect( getHdrUrlFromEnv( { mode: 'none' }, BASE ) ).toBeNull();
	} );

	it( 'resolves the built-in presets', () => {
		expect( getHdrUrlFromEnv( { preset: 'studio' }, BASE ) ).toBe( studio );
		expect( getHdrUrlFromEnv( { preset: 'outdoor' }, BASE ) ).toBe( outdoor );
		expect( getHdrUrlFromEnv( { preset: 'STUDIO' }, BASE ) ).toBe( studio );
		expect( getHdrUrlFromEnv( { preset: 'nonsense' }, BASE ) ).toBe( outdoor );
		expect( getHdrUrlFromEnv( null, BASE ) ).toBe( outdoor );
	} );

	it( 'uses a custom URL only in custom mode', () => {
		expect( getHdrUrlFromEnv( { mode: 'custom', custom_hdr_url: 'x.hdr' }, BASE ) ).toBe( 'x.hdr' );
		// Set but not selected: the preset still wins.
		expect( getHdrUrlFromEnv( { mode: 'preset', custom_hdr_url: 'x.hdr' }, BASE ) ).toBe( outdoor );
		// Selected but empty: fall back rather than return an empty URL.
		expect( getHdrUrlFromEnv( { mode: 'custom', custom_hdr_url: '' }, BASE ) ).toBe( outdoor );
	} );

	it( 'resolves an HDRi environment object', () => {
		const objects3d = [ {
			_id: 7,
			object_type: 'environment',
			env_type: 'hdri',
			env_hdri_file: { url: 'studio.hdr' },
		} ];
		expect( getHdrUrlFromEnv( { mode: 'object', object_id: 7 }, BASE, objects3d ) ).toBe( 'studio.hdr' );
		expect( getHdrUrlFromEnv( { mode: 'object', object_id: '7' }, BASE, objects3d ) ).toBe( 'studio.hdr' );
	} );

	it( 'returns all six faces of a complete cubemap, in order', () => {
		const objects3d = [ {
			_id: 3,
			object_type: 'environment',
			env_type: 'cubemap',
			env_cubemap_px: { url: 'px.png' },
			env_cubemap_nx: { url: 'nx.png' },
			env_cubemap_py: { url: 'py.png' },
			env_cubemap_ny: { url: 'ny.png' },
			env_cubemap_pz: { url: 'pz.png' },
			env_cubemap_nz: { url: 'nz.png' },
		} ];
		expect( getHdrUrlFromEnv( { mode: 'object', object_id: 3 }, BASE, objects3d ) )
			.toEqual( [ 'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png' ] );
	} );

	it( 'refuses a cubemap with a missing face instead of returning a broken array', () => {
		// The regression that shipped in the admin preview: a missing face is
		// undefined, not null, so a "remove the empties" filter kept the hole and
		// CubeTextureLoader was handed an incomplete list.
		const objects3d = [ {
			_id: 3,
			object_type: 'environment',
			env_type: 'cubemap',
			env_cubemap_px: { url: 'px.png' },
			env_cubemap_nx: { url: 'nx.png' },
			env_cubemap_py: { url: 'py.png' },
			env_cubemap_ny: { url: 'ny.png' },
			env_cubemap_pz: { url: 'pz.png' },
			// nz absent
		} ];
		const result = getHdrUrlFromEnv( { mode: 'object', object_id: 3 }, BASE, objects3d );
		expect( Array.isArray( result ) ).toBe( false );
		expect( result ).toBe( outdoor );
	} );

	it( 'falls back to the preset when the object is missing or the wrong type', () => {
		expect( getHdrUrlFromEnv( { mode: 'object', object_id: 99 }, BASE, [] ) ).toBe( outdoor );
		expect( getHdrUrlFromEnv(
			{ mode: 'object', object_id: 1 },
			BASE,
			[ { _id: 1, object_type: 'gltf' } ]
		) ).toBe( outdoor );
	} );

	it( 'treats an empty object_id as no selection', () => {
		expect( getHdrUrlFromEnv( { mode: 'object', object_id: '  ' }, BASE, [] ) ).toBe( outdoor );
	} );
} );

describe( 'findObject / findObjectByCompositeId', () => {
	// Minimal Object3D-shaped stubs: these functions only walk name/uuid/children.
	const node = ( name, children = [], extra = {} ) => ( {
		name,
		uuid: 'uuid-' + name,
		children,
		userData: {},
		...extra,
	} );

	const buildScene = () => {
		const seatA = node( 'Seat' );
		const seatB = node( 'Seat' );
		const chair = node( 'chair', [ node( 'Legs' ), seatA ], { userData: { object_id: '10' } } );
		const table = node( 'table', [ seatB ], { userData: { attachment_id: 55 } } );
		return { root: node( 'root', [ chair, table ] ), chair, table, seatA, seatB };
	};

	it( 'finds by name and by uuid, and returns null when absent', () => {
		const { root, seatA } = buildScene();
		expect( findObject( root, 'Legs' ).name ).toBe( 'Legs' );
		expect( findObject( root, seatA.uuid ) ).toBe( seatA );
		expect( findObject( root, 'nope' ) ).toBeNull();
		expect( findObject( null, 'Legs' ) ).toBeNull();
		expect( findObject( root, '' ) ).toBeNull();
	} );

	it( 'disambiguates a duplicated name by its owning model', () => {
		// Both models contain a "Seat"; the composite id is what tells them apart.
		const { root, seatA, seatB } = buildScene();
		expect( findObjectByCompositeId( root, '10:Seat' ) ).toBe( seatA );
		expect( findObjectByCompositeId( root, '55:Seat' ) ).toBe( seatB );
	} );

	it( 'matches the source half against either object_id or attachment_id', () => {
		const { root } = buildScene();
		expect( findObjectByCompositeId( root, '10:Legs' ).name ).toBe( 'Legs' );
		expect( findObjectByCompositeId( root, '55:Seat' ).name ).toBe( 'Seat' );
	} );

	it( 'returns null for an unknown source, an unknown name, or an empty name', () => {
		const { root } = buildScene();
		expect( findObjectByCompositeId( root, '999:Seat' ) ).toBeNull();
		expect( findObjectByCompositeId( root, '10:Missing' ) ).toBeNull();
		expect( findObjectByCompositeId( root, '10:' ) ).toBeNull();
	} );

	it( 'falls back to a whole-tree search for a bare id', () => {
		const { root, seatA } = buildScene();
		// No separator: first match anywhere wins.
		expect( findObjectByCompositeId( root, 'Seat' ) ).toBe( seatA );
		expect( findObjectByCompositeId( root, 'Legs' ).name ).toBe( 'Legs' );
	} );
} );

describe( 'getPixelRatio', () => {
	const original = window.devicePixelRatio;
	const setDpr = ( value ) =>
		Object.defineProperty( window, 'devicePixelRatio', { value, configurable: true } );
	afterEach( () => setDpr( original ) );

	it( 'caps a phone-class ratio', () => {
		setDpr( 3 );
		expect( getPixelRatio() ).toBe( MAX_PIXEL_RATIO );
	} );

	it( 'passes through anything under the cap', () => {
		setDpr( 1.5 );
		expect( getPixelRatio() ).toBe( 1.5 );
	} );

	it( 'never drops below 1, and honours an explicit cap', () => {
		setDpr( 0.5 );
		expect( getPixelRatio() ).toBe( 1 );
		setDpr( 3 );
		expect( getPixelRatio( 1.5 ) ).toBe( 1.5 );
	} );
} );
