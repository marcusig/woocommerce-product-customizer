/**
 * Admin 3D lights: getLightsFromSceneForImport (for GLTF upload → objects3d). createLightFromSettings from shared utils.
 */
import { createLightFromSettings, applyLightCookie } from '../../../../js/source/3d-viewer/3d-scene-utils.js';

/**
 * Collect light descriptors from a Three.js scene for importing as objects3d of type 'light'.
 * @param {THREE.Object3D} root - Scene or group to traverse
 * @returns {Array<{ name: string, type: string, color: string, intensity: number, position: { x, y, z }, target: { x, y, z }|null }>}
 */
export function getLightsFromSceneForImport( root ) {
	const lights = [];
	if ( ! root || ! root.traverse ) return lights;
	root.traverse( ( obj ) => {
		if ( ! obj.isLight ) return;
		const hex = ( obj.color && obj.color.getHex ) ? obj.color.getHex() : 0xffffff;
		const color = '#' + ( '000000' + hex.toString( 16 ) ).slice( -6 );
		const type = obj.type || 'PointLight';
		const position = obj.position ? { x: obj.position.x, y: obj.position.y, z: obj.position.z } : { x: 0, y: 0, z: 0 };
		let target = null;
		if ( obj.target && obj.target.position ) {
			target = { x: obj.target.position.x, y: obj.target.position.y, z: obj.target.position.z };
		}
		lights.push( {
			name: ( obj.name && obj.name.trim() ) || type + ' ' + ( lights.length + 1 ),
			type,
			color,
			intensity: obj.intensity != null ? obj.intensity : 1,
			cast_shadows: obj.castShadow === true,
			position,
			target,
		} );
	} );
	return lights;
}

window.PC = window.PC || {};
window.PC.threeD = window.PC.threeD || {};
window.PC.threeD.createLightFromSettings = createLightFromSettings;
window.PC.threeD.applyLightCookie = applyLightCookie;
window.PC.threeD.getLightsFromSceneForImport = getLightsFromSceneForImport;
