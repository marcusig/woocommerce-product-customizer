/**
 * Tests for the material:applied notifications emitted by the choice action
 * handlers.
 *
 * Add-ons that install their own material — a ShaderMaterial, or a stock one
 * patched through onBeforeCompile — rely on these to know when a choice has
 * overwritten their work and on what. The details that matter are which
 * material or meshes are named, and that a handler which does nothing stays
 * silent: an add-on that reinstates its shader on every notification would
 * otherwise fight the configurator over choices that never touched it.
 */
import { apply_choice_actions, restore_choice_actions } from '../3d-action-handlers.js';

function make_material( name ) {
	let hex = 0x336699;
	return {
		name,
		userData: {},
		roughness: 0.5,
		map: null,
		needsUpdate: false,
		color: {
			getHex: () => hex,
			set: ( value ) => { hex = value; },
			setHex: ( value ) => { hex = value; },
		},
		get current_hex() {
			return hex;
		},
	};
}

function make_mesh( material ) {
	return { isMesh: true, material, userData: {} };
}

function make_context( overrides = {} ) {
	const registry = new Map();
	const notify = jest.fn();
	return Object.assign( { registry, notify }, overrides );
}

describe( 'material_property notifications', () => {
	it( 'reports the material it wrote to, then reports the restore', () => {
		const ctx = make_context();
		const mat = make_material( 'Body' );
		ctx.registry.set( 'Body', mat );
		const action = {
			action_type: 'material_property',
			material_name: 'Body',
			material_property_name: 'roughness',
			material_property_value: '0.1',
		};

		apply_choice_actions( ctx, [ action ] );

		expect( ctx.notify ).toHaveBeenCalledTimes( 1 );
		expect( ctx.notify.mock.calls[ 0 ][ 0 ] ).toMatchObject( {
			phase: 'apply',
			action_type: 'material_property',
			material: mat,
			material_name: 'Body',
			meshes: [],
		} );
		expect( mat.roughness ).toBe( 0.1 );

		restore_choice_actions( ctx, [ action ] );

		expect( ctx.notify ).toHaveBeenCalledTimes( 2 );
		expect( ctx.notify.mock.calls[ 1 ][ 0 ] ).toMatchObject( {
			phase: 'restore',
			action_type: 'material_property',
			material: mat,
		} );
		expect( mat.roughness ).toBe( 0.5 );
	} );

	it( 'stays silent when the property is not on the allowlist', () => {
		const ctx = make_context();
		ctx.registry.set( 'Body', make_material( 'Body' ) );

		apply_choice_actions( ctx, [ {
			action_type: 'material_property',
			material_name: 'Body',
			material_property_name: 'onBeforeCompile',
			material_property_value: '1',
		} ] );

		expect( ctx.notify ).not.toHaveBeenCalled();
	} );

	it( 'stays silent when the named material is not in the registry', () => {
		const ctx = make_context();

		apply_choice_actions( ctx, [ {
			action_type: 'material_property',
			material_name: 'Missing',
			material_property_name: 'roughness',
			material_property_value: '0.1',
		} ] );

		expect( ctx.notify ).not.toHaveBeenCalled();
	} );
} );

describe( 'material_color_registry notifications', () => {
	it( 'reports both phases and does not report a restore with nothing recorded', () => {
		const ctx = make_context();
		const mat = make_material( 'Body' );
		ctx.registry.set( 'Body', mat );
		const action = {
			action_type: 'material_color_registry',
			material_name: 'Body',
			material_registry_color: '#ff0000',
		};

		// Nothing was ever applied, so there is no default to put back.
		restore_choice_actions( ctx, [ action ] );
		expect( ctx.notify ).not.toHaveBeenCalled();

		apply_choice_actions( ctx, [ action ] );
		expect( ctx.notify.mock.calls[ 0 ][ 0 ] ).toMatchObject( {
			phase: 'apply',
			action_type: 'material_color_registry',
			material: mat,
			material_name: 'Body',
		} );

		restore_choice_actions( ctx, [ action ] );
		expect( ctx.notify.mock.calls[ 1 ][ 0 ] ).toMatchObject( { phase: 'restore' } );
	} );
} );

describe( 'apply_material notifications', () => {
	it( 'names the meshes whose material reference was reassigned', () => {
		const original = make_material( 'Original' );
		const swapped = make_material( 'Swapped' );
		const mesh = make_mesh( original );
		const ctx = make_context( { target_object: mesh } );
		ctx.registry.set( 'Swapped', swapped );
		const action = { action_type: 'apply_material', material_name: 'Swapped' };

		apply_choice_actions( ctx, [ action ] );

		const applied = ctx.notify.mock.calls[ 0 ][ 0 ];
		expect( applied ).toMatchObject( {
			phase: 'apply',
			action_type: 'apply_material',
			material: swapped,
			material_name: 'Swapped',
		} );
		expect( applied.meshes ).toEqual( [ mesh ] );
		expect( mesh.material ).toBe( swapped );

		restore_choice_actions( ctx, [ action ] );

		const restored = ctx.notify.mock.calls[ 1 ][ 0 ];
		expect( restored.phase ).toBe( 'restore' );
		expect( restored.meshes ).toEqual( [ mesh ] );
		expect( mesh.material ).toBe( original );
	} );

	it( 'walks a group and reports every mesh under it', () => {
		const swapped = make_material( 'Swapped' );
		const a = make_mesh( make_material( 'A' ) );
		const b = make_mesh( make_material( 'B' ) );
		const group = {
			isMesh: false,
			userData: {},
			traverse: ( fn ) => { [ a, b ].forEach( fn ); },
		};
		const ctx = make_context( { target_object: group } );
		ctx.registry.set( 'Swapped', swapped );

		apply_choice_actions( ctx, [ { action_type: 'apply_material', material_name: 'Swapped' } ] );

		expect( ctx.notify.mock.calls[ 0 ][ 0 ].meshes ).toEqual( [ a, b ] );
	} );
} );

describe( 'material_texture notifications', () => {
	it( 'fires from the load callback, not the call that started it', () => {
		const ctx = make_context();
		const mat = make_material( 'Body' );
		ctx.registry.set( 'Body', mat );

		let deliver = null;
		ctx.texture_loader = { load: ( url, on_load ) => { deliver = on_load; } };
		ctx.request_render = jest.fn();

		apply_choice_actions( ctx, [ {
			action_type: 'material_texture',
			material_name: 'Body',
			material_texture_url: 'https://example.test/wood.jpg',
		} ] );

		// The texture has not arrived, so the material is untouched and there is
		// nothing to announce yet.
		expect( ctx.notify ).not.toHaveBeenCalled();

		deliver( { colorSpace: null } );

		expect( ctx.notify ).toHaveBeenCalledTimes( 1 );
		expect( ctx.notify.mock.calls[ 0 ][ 0 ] ).toMatchObject( {
			phase: 'apply',
			action_type: 'material_texture',
			material: mat,
			material_name: 'Body',
		} );
		expect( ctx.request_render ).toHaveBeenCalled();
	} );
} );

describe( 'context without a notify callback', () => {
	it( 'applies actions as before', () => {
		const registry = new Map();
		const mat = make_material( 'Body' );
		registry.set( 'Body', mat );

		expect( () => apply_choice_actions( { registry }, [ {
			action_type: 'material_property',
			material_name: 'Body',
			material_property_name: 'roughness',
			material_property_value: '0.2',
		} ] ) ).not.toThrow();

		expect( mat.roughness ).toBe( 0.2 );
	} );
} );
