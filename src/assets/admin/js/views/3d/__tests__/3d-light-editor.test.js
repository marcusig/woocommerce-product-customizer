/**
 * Tests for the admin preview's light helpers and light gizmo.
 */
import * as THREE from 'three';
import {
	create_light_editor,
	helper_size_for,
	modes_for,
	vector_to_setting,
	euler_to_setting,
	HIGHLIGHT_COLOR,
} from '../3d-light-editor.js';

/** Stands in for three's TransformControls: same surface, no pointer maths. */
class FakeTransformControls extends THREE.EventDispatcher {
	constructor() {
		super();
		this.axis = null;
		this.dragging = false;
		this.mode = 'translate';
		this.object = undefined;
		this.disposed = false;
		this._root = new THREE.Object3D();
		this._root.visible = false;
	}
	getHelper() {
		return this._root;
	}
	setSize() {}
	setMode( mode ) {
		this.mode = mode;
	}
	attach( object ) {
		this.object = object;
		this._root.visible = true;
	}
	detach() {
		this.object = undefined;
		this._root.visible = false;
	}
	dispose() {
		this.disposed = true;
	}
}

let transform;
function TransformControls() {
	transform = new FakeTransformControls();
	return transform;
}

/** A 100x100 canvas, looking down -z at the origin from z = 10. */
function setup( extra = {} ) {
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera( 45, 1, 0.1, 100 );
	camera.position.set( 0, 0, 10 );
	camera.lookAt( 0, 0, 0 );
	camera.updateMatrixWorld();
	const dom = document.createElement( 'canvas' );
	dom.getBoundingClientRect = () => ( { left: 0, top: 0, width: 100, height: 100 } );
	const orbit = { enabled: true };
	const calls = { commit: [], select: [], change: 0, hover: [] };
	const editor = create_light_editor( {
		THREE,
		TransformControls,
		scene,
		camera,
		dom,
		orbit,
		size: 1,
		on_change: () => calls.change++,
		on_commit: ( entry, handle ) => calls.commit.push( { entry, handle } ),
		on_select: ( entry, handle ) => calls.select.push( { entry, handle } ),
		on_hover: ( entry ) => calls.hover.push( entry ),
		...extra,
	} );
	return { scene, camera, dom, orbit, editor, calls };
}

function add_light( scene, editor, light, meta ) {
	scene.add( light );
	if ( light.target ) scene.add( light.target );
	scene.updateMatrixWorld();
	return editor.add( light, meta );
}

function click( dom, x, y, { to_x = x, to_y = y } = {} ) {
	dom.dispatchEvent( new MouseEvent( 'pointerdown', { clientX: x, clientY: y, button: 0 } ) );
	dom.dispatchEvent( new MouseEvent( 'pointerup', { clientX: to_x, clientY: to_y, button: 0 } ) );
}

describe( 'helpers', () => {
	test( 'every light type the admin offers gets a helper', () => {
		const { scene, editor } = setup();
		const lights = [
			new THREE.AmbientLight(),
			new THREE.DirectionalLight(),
			new THREE.PointLight(),
			new THREE.SpotLight(),
			new THREE.HemisphereLight(),
		];
		lights.forEach( ( l ) => add_light( scene, editor, l ) );
		editor.entries.forEach( ( entry ) => {
			expect( entry.helper ).not.toBeNull();
			expect( entry.helper.parent ).toBe( editor.overlay );
		} );
	} );

	test( 'a rect area light gets the addon helper when it is passed in', () => {
		class RectAreaLightHelper extends THREE.Object3D {
			constructor( light ) {
				super();
				this.light = light;
			}
		}
		const { scene, editor } = setup( { RectAreaLightHelper } );
		const entry = add_light( scene, editor, new THREE.RectAreaLight( 0xffffff, 1, 2, 1 ) );
		expect( entry.helper ).toBeInstanceOf( RectAreaLightHelper );
	} );

	test( 'the ambient marker follows the light and takes its colour', () => {
		const { scene, editor } = setup();
		const light = new THREE.AmbientLight( 0xff0000 );
		const entry = add_light( scene, editor, light );
		light.position.set( 1, 2, 3 );
		light.updateMatrixWorld();
		light.color.set( 0x00ff00 );
		editor.update();
		expect( new THREE.Vector3().setFromMatrixPosition( entry.helper.matrix ) ).toEqual( new THREE.Vector3( 1, 2, 3 ) );
		expect( entry.helper.material.color.getHex() ).toBe( 0x00ff00 );
	} );

	test( 'hide_temporarily hides everything and puts back what was there', () => {
		const { scene, editor } = setup();
		const entry = add_light( scene, editor, new THREE.SpotLight() );
		editor.select( entry, 'light' );
		const restore = editor.hide_temporarily();
		expect( editor.overlay.visible ).toBe( false );
		expect( transform.getHelper().visible ).toBe( false );
		expect( entry.target_marker.visible ).toBe( false );
		restore();
		expect( editor.overlay.visible ).toBe( true );
		expect( transform.getHelper().visible ).toBe( true );
		expect( entry.target_marker.visible ).toBe( true );
	} );

	test( 'the gizmo stays hidden after the pass when nothing was selected', () => {
		const { scene, editor } = setup();
		add_light( scene, editor, new THREE.PointLight() );
		editor.hide_temporarily()();
		expect( transform.getHelper().visible ).toBe( false );
	} );
} );

describe( 'targets', () => {
	test( 'a free target gets a handle, a target following an object does not', () => {
		const { scene, editor } = setup();
		const free = add_light( scene, editor, new THREE.DirectionalLight() );
		const locked = add_light( scene, editor, new THREE.SpotLight(), { target_locked: true } );
		expect( free.target_marker ).not.toBeNull();
		expect( free.target_marker.parent ).toBe( free.light.target );
		expect( locked.target_marker ).toBeNull();
	} );

	test( 'lights without a target get no target handle', () => {
		const { scene, editor } = setup();
		const entry = add_light( scene, editor, new THREE.PointLight() );
		expect( entry.target_marker ).toBeNull();
	} );
} );

describe( 'picking', () => {
	test( 'clicking a light selects it and attaches the gizmo', () => {
		const { scene, dom, editor, calls } = setup();
		const entry = add_light( scene, editor, new THREE.PointLight() );
		click( dom, 50, 50 );
		expect( editor.selected ).toBe( entry );
		expect( editor.selected_handle ).toBe( 'light' );
		expect( transform.object ).toBe( entry.light );
		expect( calls.select ).toHaveLength( 1 );
	} );

	test( 'clicking a target selects the target', () => {
		const { scene, dom, editor } = setup();
		const light = new THREE.DirectionalLight();
		light.position.set( 3, 0, 0 );
		light.target.position.set( 0, 0, 0 );
		const entry = add_light( scene, editor, light );
		click( dom, 50, 50 );
		expect( editor.selected ).toBe( entry );
		expect( editor.selected_handle ).toBe( 'target' );
		expect( transform.object ).toBe( light.target );
	} );

	test( 'clicking empty space deselects', () => {
		const { scene, dom, editor, calls } = setup();
		const entry = add_light( scene, editor, new THREE.PointLight() );
		editor.select( entry, 'light' );
		click( dom, 2, 2 );
		expect( editor.selected ).toBeNull();
		expect( transform.object ).toBeUndefined();
		expect( calls.select[ calls.select.length - 1 ] ).toEqual( { entry: null, handle: null } );
	} );

	test( 'an orbit that starts on a light does not select it', () => {
		const { scene, dom, editor } = setup();
		add_light( scene, editor, new THREE.PointLight() );
		click( dom, 50, 50, { to_x: 80, to_y: 50 } );
		expect( editor.selected ).toBeNull();
	} );

	test( 'a click on the gizmo keeps the selection', () => {
		const { scene, dom, editor } = setup();
		const entry = add_light( scene, editor, new THREE.PointLight() );
		editor.select( entry, 'light' );
		transform.axis = 'X';
		click( dom, 2, 2 );
		expect( editor.selected ).toBe( entry );
	} );

	test( 'Escape deselects', () => {
		const { scene, editor } = setup();
		const entry = add_light( scene, editor, new THREE.PointLight() );
		editor.select( entry, 'light' );
		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape' } ) );
		expect( editor.selected ).toBeNull();
	} );
} );

describe( 'dragging', () => {
	test( 'the orbit is disabled for the drag and a drag does not count as a click', () => {
		const { scene, dom, editor, orbit } = setup();
		const entry = add_light( scene, editor, new THREE.PointLight() );
		editor.select( entry, 'light' );
		dom.dispatchEvent( new MouseEvent( 'pointerdown', { clientX: 2, clientY: 2, button: 0 } ) );
		transform.dispatchEvent( { type: 'dragging-changed', value: true } );
		expect( orbit.enabled ).toBe( false );
		transform.dispatchEvent( { type: 'dragging-changed', value: false } );
		dom.dispatchEvent( new MouseEvent( 'pointerup', { clientX: 2, clientY: 2, button: 0 } ) );
		expect( orbit.enabled ).toBe( true );
		expect( editor.selected ).toBe( entry );
	} );

	test( 'every step reports a change, the release reports one commit', () => {
		const { scene, editor, calls } = setup();
		const entry = add_light( scene, editor, new THREE.SpotLight() );
		editor.select( entry, 'target' );
		entry.light.target.position.set( 1, 0, 0 );
		transform.dispatchEvent( { type: 'objectChange' } );
		transform.dispatchEvent( { type: 'objectChange' } );
		transform.dispatchEvent( { type: 'mouseUp' } );
		expect( calls.change ).toBe( 2 );
		expect( calls.commit ).toEqual( [ { entry, handle: 'target' } ] );
	} );

	test( 'rotate is only offered for a rect area light', () => {
		const { scene, editor } = setup();
		const point = add_light( scene, editor, new THREE.PointLight() );
		const rect = add_light( scene, editor, new THREE.RectAreaLight() );
		editor.select( point, 'light' );
		editor.set_mode( 'rotate' );
		expect( editor.mode ).toBe( 'translate' );
		editor.select( rect, 'light' );
		editor.set_mode( 'rotate' );
		expect( transform.mode ).toBe( 'rotate' );
		// Switching to a light that cannot rotate falls back to moving it.
		editor.select( point, 'light' );
		expect( transform.mode ).toBe( 'translate' );
	} );
} );

describe( 'enabled', () => {
	test( 'turning off hides everything, drops the selection and stops picking', () => {
		const { scene, dom, editor } = setup();
		const entry = add_light( scene, editor, new THREE.SpotLight() );
		editor.select( entry, 'light' );
		editor.set_enabled( false );
		expect( editor.selected ).toBeNull();
		expect( editor.overlay.visible ).toBe( false );
		expect( entry.target_marker.visible ).toBe( false );
		expect( transform.getHelper().visible ).toBe( false );
		click( dom, 50, 50 );
		expect( editor.selected ).toBeNull();
		editor.select( entry, 'light' );
		expect( editor.selected ).toBeNull();
	} );

	test( 'turning back on shows the helpers and allows picking again', () => {
		const { scene, dom, editor } = setup();
		const entry = add_light( scene, editor, new THREE.SpotLight() );
		editor.set_enabled( false );
		editor.set_enabled( true );
		expect( editor.overlay.visible ).toBe( true );
		expect( entry.target_marker.visible ).toBe( true );
		click( dom, 50, 50 );
		expect( editor.selected ).toBe( entry );
	} );

	test( 'lights added while off stay hidden', () => {
		const { scene, editor } = setup();
		editor.set_enabled( false );
		const entry = add_light( scene, editor, new THREE.DirectionalLight() );
		expect( entry.target_marker.visible ).toBe( false );
	} );

	test( 'the fake shadow pass does not turn a disabled editor back on', () => {
		const { scene, editor } = setup();
		const entry = add_light( scene, editor, new THREE.SpotLight() );
		editor.set_enabled( false );
		editor.hide_temporarily()();
		expect( editor.overlay.visible ).toBe( false );
		expect( entry.target_marker.visible ).toBe( false );
	} );
} );

describe( 'find and sync', () => {
	test( 'find returns the entry for a model', () => {
		const { scene, editor } = setup();
		const model = {};
		const entry = add_light( scene, editor, new THREE.PointLight(), { model } );
		expect( editor.find( model ) ).toBe( entry );
		expect( editor.find( {} ) ).toBeNull();
	} );

	test( 'sync picks up a typed position and a new colour', () => {
		const { scene, editor } = setup();
		const light = new THREE.SpotLight( 0xff0000 );
		const entry = add_light( scene, editor, light );
		light.position.set( 4, 5, 6 );
		light.color.set( 0x0000ff );
		editor.sync( entry );
		expect( new THREE.Vector3().setFromMatrixPosition( light.matrixWorld ) ).toEqual( new THREE.Vector3( 4, 5, 6 ) );
		expect( entry.target_marker.material.color.getHex() ).toBe( 0x0000ff );
	} );
} );

describe( 'highlight', () => {
	test( 'a highlighted light draws in the highlight colour, on top of the model', () => {
		const { scene, editor, calls } = setup();
		const entry = add_light( scene, editor, new THREE.SpotLight( 0xff0000 ) );
		editor.highlight( entry );
		editor.update();
		expect( editor.highlighted ).toBe( entry );
		expect( entry.helper.cone.material.color.getHex() ).toBe( HIGHLIGHT_COLOR );
		expect( entry.helper.cone.material.depthTest ).toBe( false );
		expect( entry.target_marker.material.color.getHex() ).toBe( HIGHLIGHT_COLOR );
		expect( calls.hover ).toEqual( [ entry ] );
	} );

	test( 'clearing it puts the light colour and depth test back', () => {
		const { scene, editor, calls } = setup();
		const entry = add_light( scene, editor, new THREE.PointLight( 0xff0000 ) );
		editor.highlight( entry );
		editor.highlight( null );
		editor.update();
		expect( entry.helper.material.color.getHex() ).toBe( 0xff0000 );
		expect( entry.helper.material.depthTest ).toBe( true );
		expect( entry.helper.renderOrder ).toBe( 0 );
		expect( calls.hover ).toEqual( [ entry, null ] );
	} );

	test( 'the hemisphere helper drops its sky and ground colours while highlighted', () => {
		const { scene, editor } = setup();
		const entry = add_light( scene, editor, new THREE.HemisphereLight( 0xff0000, 0x00ff00 ) );
		editor.highlight( entry );
		expect( entry.helper.material.vertexColors ).toBe( false );
		expect( entry.helper.material.color.getHex() ).toBe( HIGHLIGHT_COLOR );
		editor.highlight( null );
		expect( entry.helper.material.vertexColors ).toBe( true );
		expect( entry.helper.material.color.getHex() ).toBe( 0xffffff );
	} );

	test( 'the ambient marker honours the highlight too', () => {
		const { scene, editor } = setup();
		const entry = add_light( scene, editor, new THREE.AmbientLight( 0xff0000 ) );
		editor.highlight( entry );
		editor.update();
		expect( entry.helper.material.color.getHex() ).toBe( HIGHLIGHT_COLOR );
	} );

	test( 'hovering a light in the preview highlights it, moving off clears it', () => {
		const { scene, dom, editor } = setup();
		const entry = add_light( scene, editor, new THREE.PointLight() );
		dom.dispatchEvent( new MouseEvent( 'pointermove', { clientX: 50, clientY: 50 } ) );
		expect( editor.highlighted ).toBe( entry );
		dom.dispatchEvent( new MouseEvent( 'pointermove', { clientX: 2, clientY: 2 } ) );
		expect( editor.highlighted ).toBeNull();
		dom.dispatchEvent( new MouseEvent( 'pointermove', { clientX: 50, clientY: 50 } ) );
		dom.dispatchEvent( new MouseEvent( 'pointerleave' ) );
		expect( editor.highlighted ).toBeNull();
	} );

	test( 'moving over empty canvas leaves a highlight from the list alone', () => {
		const { scene, dom, editor } = setup();
		const entry = add_light( scene, editor, new THREE.PointLight() );
		editor.highlight( entry );
		dom.dispatchEvent( new MouseEvent( 'pointermove', { clientX: 2, clientY: 2 } ) );
		expect( editor.highlighted ).toBe( entry );
	} );

	test( 'nothing is highlighted while the editor is off', () => {
		const { scene, editor } = setup();
		const entry = add_light( scene, editor, new THREE.PointLight() );
		editor.highlight( entry );
		editor.set_enabled( false );
		expect( editor.highlighted ).toBeNull();
		editor.highlight( entry );
		expect( editor.highlighted ).toBeNull();
	} );
} );

describe( 'dispose', () => {
	test( 'removes what it added and stops listening', () => {
		const { scene, dom, editor, orbit } = setup();
		const light = new THREE.SpotLight();
		const entry = add_light( scene, editor, light );
		orbit.enabled = false;
		editor.dispose();
		expect( editor.overlay.parent ).toBeNull();
		expect( transform.getHelper().parent ).toBeNull();
		expect( transform.disposed ).toBe( true );
		expect( light.children ).toHaveLength( 0 );
		expect( light.target.children ).toHaveLength( 0 );
		expect( entry.target_marker.parent ).toBeNull();
		expect( orbit.enabled ).toBe( true );
		click( dom, 50, 50 );
		expect( editor.selected ).toBeNull();
	} );
} );

describe( 'setting conversion', () => {
	test( 'positions are rounded and never store -0', () => {
		expect( vector_to_setting( { x: 1.234567, y: -0.00001, z: 2 } ) ).toEqual( { x: 1.2346, y: 0, z: 2 } );
		expect( Object.is( vector_to_setting( { x: -0.00001, y: 0, z: 0 } ).x, 0 ) ).toBe( true );
	} );

	test( 'rotations are stored in degrees, as createLightFromSettings reads them', () => {
		expect( euler_to_setting( { x: Math.PI / 2, y: -Math.PI, z: 0.1 } ) ).toEqual( { x: 90, y: -180, z: 5.73 } );
	} );

	test( 'helper size follows the model, with the old fixed size as a fallback', () => {
		expect( helper_size_for( 0 ) ).toBe( 0.5 );
		expect( helper_size_for( 2000 ) ).toBe( 100 );
		expect( helper_size_for( 0.2 ) ).toBeCloseTo( 0.01 );
	} );

	test( 'modes_for', () => {
		expect( modes_for( new THREE.RectAreaLight(), 'light' ) ).toEqual( [ 'translate', 'rotate' ] );
		expect( modes_for( new THREE.SpotLight(), 'light' ) ).toEqual( [ 'translate' ] );
		expect( modes_for( new THREE.SpotLight(), 'target' ) ).toEqual( [ 'translate' ] );
	} );
} );
