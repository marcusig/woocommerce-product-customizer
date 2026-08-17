/**
 * Turn GLTFLoader / FileLoader failures into a readable message.
 *
 * Three.js FileLoader typically hands onError an ErrorEvent or ProgressEvent
 * with an empty .message. Parse failures are Error / SyntaxError. Passing any
 * onError callback also suppresses Three's own console.error, so callers must
 * log and surface this themselves.
 */

const GLTF_LOADER_PREFIX = /^THREE\.GLTFLoader:\s*/i;

const LANG_KEYS = {
	invalid: 'gltf_load_failed_invalid',
	glb_header: 'gltf_load_failed_glb_header',
	legacy: 'gltf_load_failed_legacy',
	version: 'gltf_load_failed_version',
	draco: 'gltf_load_failed_draco',
	ktx2: 'gltf_load_failed_ktx2',
	meshopt: 'gltf_load_failed_meshopt',
	network: 'gltf_load_failed_network',
	http: 'gltf_load_failed_http',
	no_scene: 'gltf_load_failed_no_scene',
	missing_url: 'gltf_load_failed_missing_url',
	generic: 'gltf_load_failed',
};

const FALLBACKS = {
	invalid: 'This file is not a valid glTF / GLB model.',
	glb_header: 'This file is not a valid GLB (binary glTF) file.',
	legacy: 'This is a legacy binary glTF file. Re-export as glTF 2.0.',
	version: 'This model uses an unsupported glTF version. Export as glTF 2.0.',
	draco: 'This model uses Draco compression, but the Draco loader is not enabled.',
	ktx2: 'This model uses KTX2 textures, but the KTX2 loader is not enabled.',
	meshopt: 'This model uses Meshopt compression, but the Meshopt decoder is not enabled.',
	network: 'The model could not be downloaded (network or CORS error).',
	http: 'The model file could not be downloaded (HTTP %s).',
	no_scene: 'The model loaded but did not contain a scene.',
	missing_url: 'No 3D file is assigned to this object.',
	generic: 'Failed to load the 3D model.',
};

/**
 * @param {string} [url]
 * @returns {string}
 */
export function get_filename_from_url( url ) {
	if ( ! url ) {
		return '';
	}
	try {
		const path = String( url ).split( '?' )[ 0 ];
		const parts = path.split( '/' );
		return decodeURIComponent( parts[ parts.length - 1 ] || '' );
	} catch ( error ) {
		return String( url );
	}
}

/**
 * @param {*} err
 * @returns {string}
 */
export function extract_gltf_load_error_raw( err ) {
	if ( err == null ) {
		return '';
	}
	if ( typeof err === 'string' ) {
		return err;
	}
	if ( err.message && String( err.message ).trim() ) {
		return String( err.message );
	}
	const xhr = err.target;
	if ( xhr && typeof xhr.status === 'number' ) {
		if ( xhr.status === 0 ) {
			return FALLBACKS.network;
		}
		const status_text = xhr.statusText ? ( ' ' + xhr.statusText ) : '';
		return 'HTTP ' + xhr.status + status_text;
	}
	if ( err.type === 'error' ) {
		return FALLBACKS.network;
	}
	return '';
}

/**
 * @param {string} raw
 * @param {*} err
 * @returns {{ code: string, fallback: string, http_status?: number }}
 */
function classify_gltf_load_error( raw, err ) {
	const text = String( raw || '' );
	const lower = text.toLowerCase();
	const xhr = err && err.target;
	const http_status = ( xhr && typeof xhr.status === 'number' ) ? xhr.status : null;

	if ( /unexpected token|json\.parse|not valid json|unexpected character|json content not found/i.test( text ) ) {
		return { code: 'invalid', fallback: FALLBACKS.invalid };
	}
	if ( /unsupported gltf-binary header/i.test( text ) ) {
		return { code: 'glb_header', fallback: FALLBACKS.glb_header };
	}
	if ( /legacy binary file/i.test( text ) ) {
		return { code: 'legacy', fallback: FALLBACKS.legacy };
	}
	if ( /unsupported asset|gltf versions\s*>=\s*2/i.test( text ) ) {
		return { code: 'version', fallback: FALLBACKS.version };
	}
	if ( /no dracoloader/i.test( text ) ) {
		return { code: 'draco', fallback: FALLBACKS.draco };
	}
	if ( /setktx2loader must be called|no ktx2loader/i.test( text ) ) {
		return { code: 'ktx2', fallback: FALLBACKS.ktx2 };
	}
	if ( /setmeshoptdecoder must be called/i.test( text ) ) {
		return { code: 'meshopt', fallback: FALLBACKS.meshopt };
	}
	if ( /did not contain a scene/i.test( text ) ) {
		return { code: 'no_scene', fallback: FALLBACKS.no_scene };
	}
	if ( /no 3d file is assigned/i.test( text ) ) {
		return { code: 'missing_url', fallback: FALLBACKS.missing_url };
	}
	if ( http_status === 0 || lower.indexOf( 'cors' ) !== -1 || lower.indexOf( 'network' ) !== -1 ) {
		return { code: 'network', fallback: FALLBACKS.network };
	}
	if ( http_status != null && http_status > 0 ) {
		return {
			code: 'http',
			fallback: FALLBACKS.http.replace( '%s', String( http_status ) ),
			http_status,
		};
	}

	const stripped = text.replace( GLTF_LOADER_PREFIX, '' ).trim();
	return {
		code: 'generic',
		fallback: stripped || FALLBACKS.generic,
	};
}

/**
 * @param {*} err
 * @param {string} [url]
 * @returns {{ code: string, message: string, details: Object, raw: string }}
 */
export function get_gltf_load_error_info( err, url ) {
	const raw = extract_gltf_load_error_raw( err );
	const classified = classify_gltf_load_error( raw, err );
	const details = {};
	if ( url ) {
		details.url = url;
		const filename = get_filename_from_url( url );
		if ( filename ) {
			details.filename = filename;
		}
	}
	if ( raw && raw !== classified.fallback ) {
		details.raw = raw.replace( GLTF_LOADER_PREFIX, '' ).trim();
	}
	if ( classified.http_status != null ) {
		details.http_status = classified.http_status;
	}
	const xhr = err && err.target;
	if ( xhr && xhr.statusText ) {
		details.http_status_text = xhr.statusText;
	}
	if ( err && err.name ) {
		details.name = err.name;
	}
	return {
		code: classified.code,
		message: classified.fallback,
		details,
		raw,
	};
}

/**
 * @param {{ code: string, message: string, details?: Object }} info
 * @returns {string}
 */
export function localize_gltf_load_error_message( info ) {
	const lang = ( typeof window !== 'undefined' && window.PC_lang ) ? window.PC_lang : {};
	const key = LANG_KEYS[ info.code ] || LANG_KEYS.generic;
	const translated = lang[ key ];
	if ( info.code === 'generic' ) {
		return info.message || translated || FALLBACKS.generic;
	}
	if ( ! translated ) {
		return info.message;
	}
	if ( info.code === 'http' && info.details && info.details.http_status != null ) {
		return translated.replace( '%s', String( info.details.http_status ) );
	}
	return translated;
}

/**
 * @param {*} err
 * @param {string} [url]
 * @returns {Error}
 */
export function normalize_gltf_load_error( err, url ) {
	const info = get_gltf_load_error_info( err, url );
	const message = localize_gltf_load_error_message( info );
	const error = new Error( message );
	error.code = info.code;
	error.url = url || '';
	error.details = info.details;
	error.original = err;
	if ( err instanceof Error ) {
		error.cause = err;
	}
	return error;
}

/**
 * Log a warning with the original error object so the console inspector still
 * has the stack / XHR event, then return a normalized Error for UI callers.
 *
 * @param {*} err
 * @param {string} [url]
 * @returns {Error}
 */
export function warn_gltf_load_error( err, url ) {
	const already_normalized = !!( err && err.details && err.message && err.code );
	const normalized = already_normalized ? err : normalize_gltf_load_error( err, url );
	if ( already_normalized ) {
		console.warn( '[PC 3D] Failed to load model:', normalized.message, normalized.details );
	} else {
		console.warn( '[PC 3D] Failed to load model:', normalized.message, normalized.details, err );
	}
	return normalized;
}

/**
 * Merchant-facing line: “Could not load “Chair.glb”: …”
 *
 * @param {string} label
 * @param {Error|*} err
 * @returns {string}
 */
export function format_gltf_load_notice( label, err ) {
	const lang = ( typeof window !== 'undefined' && window.PC_lang ) ? window.PC_lang : {};
	const reason = ( err && err.message ) ? err.message : ( lang.gltf_load_failed || FALLBACKS.generic );
	const name = label || ( err && err.details && err.details.filename ) || '';
	if ( ! name ) {
		return reason;
	}
	const template = lang.gltf_load_failed_for || 'Could not load “%s”: %s';
	return template.replace( '%s', name ).replace( '%s', reason );
}
