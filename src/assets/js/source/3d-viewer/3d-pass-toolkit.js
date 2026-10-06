/**
 * The postprocessing classes handed to add-on pass factories.
 *
 * Without this, writing a full-screen shader for the viewer would mean shipping
 * a webpack bundle: three's pass classes are bare module specifiers, so a plain
 * enqueued script cannot import them and there is no global to reach them
 * through. Handing them to the factory turns a custom shader back into a
 * snippet a developer can paste into a site plugin.
 *
 * Loaded lazily, and only when at least one factory is registered.
 */
export async function load_pass_toolkit() {
	const [ shader_pass, pass, render_pass, output_pass, copy_shader, effect_composer ] = await Promise.all( [
		import( 'three/addons/postprocessing/ShaderPass.js' ),
		import( 'three/addons/postprocessing/Pass.js' ),
		import( 'three/addons/postprocessing/RenderPass.js' ),
		import( 'three/addons/postprocessing/OutputPass.js' ),
		import( 'three/addons/shaders/CopyShader.js' ),
		import( 'three/addons/postprocessing/EffectComposer.js' ),
	] );

	return {
		ShaderPass: shader_pass.ShaderPass,
		Pass: pass.Pass,
		FullScreenQuad: pass.FullScreenQuad,
		RenderPass: render_pass.RenderPass,
		OutputPass: output_pass.OutputPass,
		CopyShader: copy_shader.CopyShader,
		EffectComposer: effect_composer.EffectComposer,
	};
}
