/**
 * DRACO loader bundle for the frontend 3D viewer.
 * Enqueued on demand when "Enable Draco compression support" is enabled.
 * Exposes DRACOLoader on window for use by GLTFLoader.
 */
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

window.DRACOLoader = DRACOLoader;
