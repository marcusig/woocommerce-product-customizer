/**
 * Frontend 3D viewer entry.
 * Exposes the 3D viewer as PC.fe.views.viewer_3d for use when configurator type is 3d.
 */
import Viewer3D from '.3d-viewer/main-viewer.js';

const wp = window.wp;

window.PC = window.PC || {};
window.PC.fe = window.PC.fe || {};
window.PC.fe.views = window.PC.fe.views || {};
window.PC.fe.views.viewer_3d = Viewer3D;

// Optional: allow themes to know 3D viewer is available
if ( wp && wp.hooks && wp.hooks.doAction ) {
	wp.hooks.doAction( 'PC.fe.viewer_3d.registered', Viewer3D );
}
