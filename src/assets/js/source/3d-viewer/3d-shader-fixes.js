/**
 * Fixes to three's built-in shader chunks.
 *
 * Applied to ShaderChunk once, before the first material compiles: three keys
 * its program cache on material parameters, not on source, so a program built
 * before the patch keeps the old code for the life of the renderer.
 */

/**
 * The anisotropic visibility term in lights_physical_pars_fragment (three
 * r182) divides by ( gv + gl ) unguarded; the isotropic V_GGX_SmithCorrelated
 * beside it uses max( gv + gl, EPSILON ). Where the shading normal faces away
 * from both light and camera, dotNL = dotNV = 0, V is Inf, and RE_Direct
 * multiplies it by an irradiance of dotNL * color = 0 — NaN. On the canvas
 * that is a scatter of black specks on brushed metal; under bloom the mip
 * chain spreads them until the whole model renders black.
 */
export const ANISOTROPIC_V_UNGUARDED = 'float v = 0.5 / ( gv + gl );';
export const ANISOTROPIC_V_GUARDED = 'float v = 0.5 / max( gv + gl, EPSILON );';

/**
 * Patch three's ShaderChunk in place. Safe to call more than once.
 *
 * @param {Object} ShaderChunk - THREE.ShaderChunk of the instance that renders
 * @returns {boolean} true when the chunk carries the fix afterwards
 */
export function apply_shader_fixes( ShaderChunk ) {
	if ( ! ShaderChunk || typeof ShaderChunk.lights_physical_pars_fragment !== 'string' ) return false;

	const chunk = ShaderChunk.lights_physical_pars_fragment;
	if ( chunk.includes( ANISOTROPIC_V_GUARDED ) ) return true;
	if ( ! chunk.includes( ANISOTROPIC_V_UNGUARDED ) ) return false;

	ShaderChunk.lights_physical_pars_fragment = chunk.replace( ANISOTROPIC_V_UNGUARDED, ANISOTROPIC_V_GUARDED );
	return true;
}
