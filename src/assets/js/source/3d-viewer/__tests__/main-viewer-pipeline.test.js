/**
 * Tests for the viewer's load pipeline being cancelled.
 *
 * Switching product or variation removes the viewer and mounts a new one, often
 * while a large model is still downloading, and a lost WebGL context starts a
 * second pipeline on the same view. The pipeline that was overtaken must stop:
 * carrying on builds onto a disposed renderer and announces runtime.ready for a
 * viewer that no longer exists, which add-ons then attach to and never release.
 */
import * as THREE from 'three';

jest.mock( '../3d-scene-lifecycle.js', () => ( {
	initScene: jest.fn(),
	cleanupThree: jest.fn(),
	apply_camera_view_offset: jest.fn(),
} ) );
jest.mock( 'three/examples/jsm/utils/SkeletonUtils.js', () => ( { clone: jest.fn() } ) );

class FakeCollection {
	reset() {}
	add() {}
	get() {
		return null;
	}
}

let viewerPrototype;
let initScene;
const doAction = jest.fn();

beforeAll( () => {
	// main-viewer reads these when it is evaluated, so it is required, not imported.
	window.Backbone = { View: { extend: ( proto ) => proto }, Events: {}, Collection: FakeCollection };
	window.wp = { template: () => () => '', hooks: { doAction, applyFilters: ( name, value ) => value } };
	viewerPrototype = require( '../main-viewer.js' ).default;
	initScene = require( '../3d-scene-lifecycle.js' ).initScene;
} );

afterAll( () => {
	delete window.Backbone;
	delete window.wp;
	delete window.PC;
} );

beforeEach( () => {
	doAction.mockClear();
	window.PC = { fe: { currentProductData: { objects3d: [] } } };
} );

function makeView( overrides = {} ) {
	return Object.assign( Object.create( viewerPrototype ), {
		_objectIdToScene: {},
		_scene_models: new FakeCollection(),
		_setLoadingStep: jest.fn(),
	}, overrides );
}

function deferred() {
	let resolve;
	const promise = new Promise( ( r ) => {
		resolve = r;
	} );
	return { promise, resolve };
}

const flush = () => new Promise( ( r ) => setTimeout( r, 0 ) );

describe( 'viewer load pipeline', () => {
	it( 'does not set up a scene for a view cleaned up while its assets loaded', async () => {
		const assets = deferred();
		const view = makeView( {
			_loadModules: jest.fn( async () => ( {} ) ),
			_loadAssets: jest.fn( () => assets.promise ),
			_setupScene: jest.fn( async () => {} ),
		} );

		const run = view._runViewerPipeline( {}, {} );
		await flush();
		view.maybe_cleanup();
		const hdrTexture = { dispose: jest.fn() };
		assets.resolve( { hdrTexture } );

		await expect( run ).rejects.toMatchObject( { isStalePipeline: true } );
		expect( view._setupScene ).not.toHaveBeenCalled();
		expect( hdrTexture.dispose ).toHaveBeenCalled();
	} );

	it( 'lets only the newest of two overlapping pipelines set up the scene', async () => {
		const first = deferred();
		const second = deferred();
		const view = makeView( {
			_loadModules: jest.fn( async () => ( {} ) ),
			_loadAssets: jest.fn()
				.mockImplementationOnce( () => first.promise )
				.mockImplementationOnce( () => second.promise ),
			_setupScene: jest.fn( async () => {} ),
		} );

		const older = view._runViewerPipeline( {}, {} );
		await flush();
		const newer = view._runViewerPipeline( {}, {} );
		await flush();
		first.resolve( {} );
		await expect( older ).rejects.toMatchObject( { isStalePipeline: true } );
		expect( view._setupScene ).not.toHaveBeenCalled();

		second.resolve( {} );
		await newer;
		expect( view._setupScene ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'never announces runtime.ready when removed while the models download', async () => {
		const models = deferred();
		initScene.mockReturnValue( {
			scene: new THREE.Scene(),
			renderer: { domElement: document.createElement( 'canvas' ), shadowMap: {} },
			resize_listeners: [],
		} );
		const view = makeView( {
			_ensureObjects3dSceneLoadedById: jest.fn( () => models.promise ),
		} );

		const setup = view._setupScene( document.createElement( 'div' ), {}, {}, { eagerObjectIds: [ '1' ] }, {} );
		await flush();
		view.maybe_cleanup();
		models.resolve( null );

		await expect( setup ).rejects.toMatchObject( { isStalePipeline: true } );
		const announced = doAction.mock.calls.map( ( call ) => call[ 0 ] );
		expect( announced ).toContain( 'PC.fe.viewer.placement.ready' );
		expect( announced ).not.toContain( 'PC.fe.viewer.runtime.ready' );
	} );

	it( 'gives up on the scene when not one model could be loaded', async () => {
		initScene.mockReturnValue( {
			scene: new THREE.Scene(),
			renderer: { domElement: document.createElement( 'canvas' ), shadowMap: {} },
			resize_listeners: [],
		} );
		const view = makeView( {
			// A failed load resolves null rather than rejecting.
			_ensureObjects3dSceneLoadedById: jest.fn( async () => null ),
		} );

		await expect(
			view._setupScene( document.createElement( 'div' ), {}, {}, { eagerObjectIds: [ '1', '2' ] }, {} )
		).rejects.toMatchObject( { isModelLoadFailed: true } );
		expect( view._three ).toBeNull();
		expect( doAction.mock.calls.map( ( call ) => call[ 0 ] ) ).not.toContain( 'PC.fe.viewer.runtime.ready' );
	} );

	it( 'shows the poster, with a reason, when no model could be loaded', () => {
		const view = makeView( { _showPosterFallback: jest.fn(), _showError: jest.fn() } );
		const err = new Error( 'no model' );
		err.isModelLoadFailed = true;

		view._handlePipelineError( err );

		expect( view._showPosterFallback ).toHaveBeenCalledWith( 'The 3D model could not be loaded.' );
		expect( view._showError ).not.toHaveBeenCalled();
	} );

	it( 'does not mount a model that arrives after the scene was torn down', async () => {
		const attrs = { url: 'model.glb', state: 'unloaded' };
		const sceneModel = {
			get: ( key ) => attrs[ key ],
			set: ( values ) => Object.assign( attrs, values ),
		};
		const modelRoot = { add: jest.fn() };
		let deliver;
		const view = makeView( {
			_three: { model_root: modelRoot },
			_scene_models: { get: () => sceneModel, reset() {} },
			_loadGltfForEntry: ( url, onSuccess ) => {
				deliver = onSuccess;
			},
		} );

		const loaded = view._ensureObjects3dSceneLoadedById( '1' );
		view.maybe_cleanup();
		deliver( { scene: new THREE.Group(), animations: [] } );

		await expect( loaded ).resolves.toBeNull();
		expect( modelRoot.add ).not.toHaveBeenCalled();
	} );
} );
