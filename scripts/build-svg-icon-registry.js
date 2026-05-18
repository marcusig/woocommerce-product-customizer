/**
 * Reads all .svg files under src/assets/icons/ (recursive) and writes
 * src/assets/admin/js/generated/svg-icon-registry.js so admin JS can merge SVG markup
 * without runtime PHP file reads.
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
