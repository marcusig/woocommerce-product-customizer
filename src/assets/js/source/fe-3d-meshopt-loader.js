/**
 * Meshopt decoder bundle for the frontend 3D viewer.
 * Enqueued on demand when "Enable Meshopt compression support" is enabled.
 * Exposes MeshoptDecoder on window for use by GLTFLoader.
 */
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

window.MeshoptDecoder = MeshoptDecoder;
