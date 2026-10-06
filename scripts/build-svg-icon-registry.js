/**
 * Reads all .svg files under src/assets/icons/ (recursive) and writes them into JS,
 * so neither side has to read SVG files from PHP at runtime.
 *
 * Two outputs, because the two bundles cannot share one:
 *
 *   src/assets/admin/js/generated/svg-icon-registry.js
 *       Every icon, as a global (PC.MKL_PC_SVG_ICON_REGISTRY) for the admin scripts.
 *
 *   src/assets/js/source/generated/svg-icons.js
 *       Only icons under icons/frontend/, as an ES module for the webpack frontend
 *       bundle. Scoped deliberately: everything in that module ships to every
 *       visitor, and the admin's icon set is far larger than the shop needs.
 *
 * Usage: node scripts/build-svg-icon-registry.js
 */
const fs = require( 'fs' );
const path = require( 'path' );

const project_root = path.resolve( __dirname, '..' );
const icons_root = path.join( project_root, 'src', 'assets', 'icons' );
const out_file = path.join(
	project_root,
	'src',
	'assets',
	'admin',
	'js',
	'generated',
	'svg-icon-registry.js'
);
/** Icons under this prefix are also emitted as an ES module for the frontend. */
const frontend_prefix = 'svg/frontend/';
const frontend_out_file = path.join(
	project_root,
	'src',
	'assets',
	'js',
	'source',
	'generated',
	'svg-icons.js'
);

function segment_is_safe( segment ) {
	return /^[a-zA-Z0-9_-]+$/.test( segment );
}

function walk_icons( dir, relative_prefix, acc ) {
	if ( ! fs.existsSync( dir ) || ! fs.statSync( dir ).isDirectory() ) {
		return;
	}
	const entries = fs.readdirSync( dir, { withFileTypes: true } );
	for ( const entry of entries ) {
		if ( entry.name.startsWith( '.' ) ) {
			continue;
		}
		const abs = path.join( dir, entry.name );
		const rel = relative_prefix ? `${ relative_prefix }/${ entry.name }` : entry.name;
		if ( entry.isDirectory() ) {
			walk_icons( abs, rel, acc );
		} else if ( entry.isFile() && entry.name.toLowerCase().endsWith( '.svg' ) ) {
			const parts = rel.split( /[/\\]/ );
			const base = parts.pop();
			const name_no_ext = base.replace( /\.svg$/i, '' );
			const segments = [ ...parts, name_no_ext ];
			let valid = true;
			for ( const segment of segments ) {
				if ( ! segment || ! segment_is_safe( segment ) ) {
					valid = false;
					break;
				}
			}
			if ( ! valid ) {
				console.warn( '[build-svg-icon-registry] Skipping invalid path:', rel );
				continue;
			}
			const key = 'svg/' + segments.join( '/' );
			const contents = fs.readFileSync( abs, 'utf8' );
			acc[ key ] = contents;
		}
	}
}

const registry = {};
walk_icons( icons_root, '', registry );

const banner =
	'/* eslint-disable */\n' +
	'/**\n' +
	' * AUTO-GENERATED — do not edit by hand.\n' +
	' * Source: all .svg files under src/assets/icons/ (recursive).\n' +
	' * Regenerate: npm run build:svg-icons\n' +
	' */\n' +
	'var PC = PC || {};\n' +
	'PC.MKL_PC_SVG_ICON_REGISTRY = ';

const body = JSON.stringify( registry, null, '\t' ) + ';\n';

fs.mkdirSync( path.dirname( out_file ), { recursive: true } );
fs.writeFileSync( out_file, banner + body, 'utf8' );

console.log(
	'[build-svg-icon-registry] Wrote',
	Object.keys( registry ).length,
	'icons to',
	path.relative( project_root, out_file )
);

// Frontend module: same markup, keyed without the icons/frontend/ prefix so a
// caller asks for 'orbit-hint/ring' rather than repeating where it lives.
const frontend_registry = {};
for ( const key of Object.keys( registry ) ) {
	if ( key.startsWith( frontend_prefix ) ) {
		frontend_registry[ key.slice( frontend_prefix.length ) ] = registry[ key ];
	}
}

const frontend_banner =
	'/* eslint-disable */\n' +
	'/**\n' +
	' * AUTO-GENERATED — do not edit by hand.\n' +
	' * Source: .svg files under src/assets/icons/frontend/ (recursive).\n' +
	' * Regenerate: npm run build:svg-icons\n' +
	' */\n' +
	'export default ';

fs.mkdirSync( path.dirname( frontend_out_file ), { recursive: true } );
fs.writeFileSync(
	frontend_out_file,
	frontend_banner + JSON.stringify( frontend_registry, null, '\t' ) + ';\n',
	'utf8'
);

console.log(
	'[build-svg-icon-registry] Wrote',
	Object.keys( frontend_registry ).length,
	'frontend icons to',
	path.relative( project_root, frontend_out_file )
);
