/**
 * Tests for the patches applied to three's shader chunks.
 *
 * The patch is a string replace on three's source, so the failure that matters
 * is a three upgrade quietly moving the line: the patch would stop applying and
 * anisotropic metal would go black under bloom again. The first test runs
 * against the installed three to catch exactly that.
 */
import * as THREE from 'three';
import { apply_shader_fixes, ANISOTROPIC_V_GUARDED, ANISOTROPIC_V_UNGUARDED } from '../3d-shader-fixes.js';

const fake_chunks = ( source ) => ( { lights_physical_pars_fragment: source } );

describe( 'apply_shader_fixes', () => {
	it( 'patches the installed three — if this fails after an upgrade, re-check the anisotropic V term', () => {
		const chunks = { ...THREE.ShaderChunk };
		const source = chunks.lights_physical_pars_fragment;
		// Either still unguarded (patch needed) or fixed upstream (patch can go).
		expect( source.includes( ANISOTROPIC_V_UNGUARDED ) || source.includes( ANISOTROPIC_V_GUARDED ) ).toBe( true );

		expect( apply_shader_fixes( chunks ) ).toBe( true );
		expect( chunks.lights_physical_pars_fragment ).not.toContain( ANISOTROPIC_V_UNGUARDED );
		expect( chunks.lights_physical_pars_fragment ).toContain( ANISOTROPIC_V_GUARDED );
	} );

	it( 'changes only the anisotropic V line', () => {
		const chunks = { ...THREE.ShaderChunk };
		const before = chunks.lights_physical_pars_fragment;
		apply_shader_fixes( chunks );
		expect( chunks.lights_physical_pars_fragment ).toBe( before.replace( ANISOTROPIC_V_UNGUARDED, ANISOTROPIC_V_GUARDED ) );
	} );

	it( 'is idempotent', () => {
		const chunks = fake_chunks( `a\n${ ANISOTROPIC_V_UNGUARDED }\nb` );
		apply_shader_fixes( chunks );
		const once = chunks.lights_physical_pars_fragment;
		expect( apply_shader_fixes( chunks ) ).toBe( true );
		expect( chunks.lights_physical_pars_fragment ).toBe( once );
	} );

	it( 'leaves an unrecognised chunk alone and reports it', () => {
		const chunks = fake_chunks( 'float v = something_else;' );
		expect( apply_shader_fixes( chunks ) ).toBe( false );
		expect( chunks.lights_physical_pars_fragment ).toBe( 'float v = something_else;' );
	} );

	it( 'tolerates a missing ShaderChunk', () => {
		expect( apply_shader_fixes( undefined ) ).toBe( false );
		expect( apply_shader_fixes( {} ) ).toBe( false );
	} );
} );
