/**
 * Tests for GLTFLoader error formatting. The admin previously swallowed these
 * because Three.js skips console.error when an onError callback is passed, and
 * FileLoader often hands over an Event with an empty .message.
 */
import {
	extract_gltf_load_error_raw,
	format_gltf_load_notice,
	get_filename_from_url,
	get_gltf_load_error_info,
	localize_gltf_load_error_message,
	normalize_gltf_load_error,
} from '../3d-gltf-load-error.js';

describe( 'get_filename_from_url', () => {
	it( 'strips the path and query string', () => {
		expect( get_filename_from_url( 'https://shop.test/uploads/chair.glb?ver=2' ) ).toBe( 'chair.glb' );
	} );

	it( 'returns empty for a missing url', () => {
		expect( get_filename_from_url( '' ) ).toBe( '' );
		expect( get_filename_from_url( null ) ).toBe( '' );
	} );
} );

describe( 'extract_gltf_load_error_raw', () => {
	it( 'uses Error.message', () => {
		expect( extract_gltf_load_error_raw( new Error( 'boom' ) ) ).toBe( 'boom' );
	} );

	it( 'reads HTTP status from an XHR-like event', () => {
		expect( extract_gltf_load_error_raw( {
			target: { status: 404, statusText: 'Not Found' },
		} ) ).toBe( 'HTTP 404 Not Found' );
	} );

	it( 'treats status 0 as a network / CORS failure', () => {
		expect( extract_gltf_load_error_raw( {
			target: { status: 0 },
		} ) ).toMatch( /network or CORS/i );
	} );

	it( 'returns empty for a blank event', () => {
		expect( extract_gltf_load_error_raw( {} ) ).toBe( '' );
	} );
} );

describe( 'get_gltf_load_error_info', () => {
	it( 'classifies a JSON parse failure as an invalid file', () => {
		const info = get_gltf_load_error_info(
			new SyntaxError( "Unexpected token '<'" ),
			'https://shop.test/broken.glb'
		);
		expect( info.code ).toBe( 'invalid' );
		expect( info.message ).toMatch( /not a valid glTF/i );
		expect( info.details.filename ).toBe( 'broken.glb' );
	} );

	it( 'classifies a bad GLB header', () => {
		const info = get_gltf_load_error_info(
			new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' )
		);
		expect( info.code ).toBe( 'glb_header' );
	} );

	it( 'classifies glTF 1.0 assets', () => {
		const info = get_gltf_load_error_info(
			new Error( 'THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.' )
		);
		expect( info.code ).toBe( 'version' );
	} );

	it( 'classifies a missing Draco loader', () => {
		const info = get_gltf_load_error_info(
			new Error( 'THREE.GLTFLoader: No DRACOLoader instance provided.' )
		);
		expect( info.code ).toBe( 'draco' );
	} );

	it( 'classifies a missing KTX2 loader', () => {
		const info = get_gltf_load_error_info(
			new Error( 'THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures' )
		);
		expect( info.code ).toBe( 'ktx2' );
	} );

	it( 'classifies a missing Meshopt decoder', () => {
		const info = get_gltf_load_error_info(
			new Error( 'THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files' )
		);
		expect( info.code ).toBe( 'meshopt' );
	} );

	it( 'keeps a stripped Three.js message for unknown errors', () => {
		global.window = global.window || {};
		const previous_lang = global.window.PC_lang;
		global.window.PC_lang = { gltf_load_failed: 'Échec du chargement.' };
		const info = get_gltf_load_error_info(
			new Error( 'THREE.GLTFLoader: Failed to load buffer "scene.bin".' )
		);
		expect( info.code ).toBe( 'generic' );
		expect( localize_gltf_load_error_message( info ) ).toBe( 'Failed to load buffer "scene.bin".' );
		global.window.PC_lang = previous_lang;
	} );

	it( 'classifies HTTP 404 from an XHR event', () => {
		const info = get_gltf_load_error_info( {
			target: { status: 404, statusText: 'Not Found' },
		} );
		expect( info.code ).toBe( 'http' );
		expect( info.details.http_status ).toBe( 404 );
		expect( info.message ).toMatch( /404/ );
	} );
} );

describe( 'localize_gltf_load_error_message', () => {
	const original_lang = global.window && global.window.PC_lang;

	afterEach( () => {
		if ( global.window ) {
			global.window.PC_lang = original_lang;
		}
	} );

	it( 'uses PC_lang when the code has a string', () => {
		global.window = global.window || {};
		global.window.PC_lang = { gltf_load_failed_invalid: 'Fichier glTF invalide.' };
		const info = get_gltf_load_error_info( new SyntaxError( 'Unexpected token' ) );
		expect( localize_gltf_load_error_message( info ) ).toBe( 'Fichier glTF invalide.' );
	} );

	it( 'falls back to the English message', () => {
		global.window = global.window || {};
		global.window.PC_lang = {};
		const info = get_gltf_load_error_info(
			new Error( 'THREE.GLTFLoader: No DRACOLoader instance provided.' )
		);
		expect( localize_gltf_load_error_message( info ) ).toMatch( /Draco/ );
	} );
} );

describe( 'normalize_gltf_load_error', () => {
	it( 'returns an Error with code, url and details', () => {
		const error = normalize_gltf_load_error(
			new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' ),
			'https://shop.test/bad.glb'
		);
		expect( error ).toBeInstanceOf( Error );
		expect( error.code ).toBe( 'glb_header' );
		expect( error.url ).toBe( 'https://shop.test/bad.glb' );
		expect( error.details.filename ).toBe( 'bad.glb' );
		expect( error.message ).toMatch( /not a valid GLB/i );
	} );
} );

describe( 'format_gltf_load_notice', () => {
	const original_lang = global.window && global.window.PC_lang;

	afterEach( () => {
		if ( global.window ) {
			global.window.PC_lang = original_lang;
		}
	} );

	it( 'combines the object label with the reason', () => {
		global.window = global.window || {};
		global.window.PC_lang = {};
		const err = normalize_gltf_load_error( new SyntaxError( "Unexpected token '<'" ) );
		expect( format_gltf_load_notice( 'Chair', err ) ).toBe(
			'Could not load “Chair”: This file is not a valid glTF / GLB model.'
		);
	} );
} );
