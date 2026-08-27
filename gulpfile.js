const gulp = require('gulp')
// const runSequence = require('run-sequence')
const zip = require('gulp-zip')
const sass = require('gulp-sass')(require('sass'));
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');
const sourcemaps = require('gulp-sourcemaps');
const colorize = require('chalk');
const clean = require('gulp-clean');
const gutil = require('gulp-util');
const concat = require('gulp-concat-util');
const { exec, spawn } = require('child_process');
const path = require('path');

// const replace = require('gulp-replace');
var plumber = require('gulp-plumber');
var wpPot = require('gulp-wp-pot');

/**
 * The webpack entries and where each one's bundle goes.
 *
 * One list for both the one-shot build and the watcher, so the two cannot drift.
 * They already had: a pair of watch tasks sat commented out here pointing at
 * `dist/build` while the build tasks wrote to `dist/assets/admin/js/build`, and
 * that kind of mismatch only ever surfaces at runtime as a chunk that fails to
 * load.
 *
 * The output paths are deliberately separate per entry. wp-scripts empties its
 * `--output-path` on every run, so two entries sharing one directory would delete
 * each other's chunks on every rebuild.
 */
const WEBPACK_TARGETS = [
	{
		entry: 'src/assets/js/source/fe-3d-viewer-entry.js',
		output: 'dist/assets/build',
	},
	{
		entry: 'src/assets/admin/js/views/3d-settings.js',
		output: 'dist/assets/admin/js/build',
	},
];

/** Long-running children, so they go down with gulp. */
const spawned = [];

/**
 * Run wp-scripts against every entry, one child each.
 *
 * @param {string} command - 'build' (one shot) or 'start' (watch)
 * @returns {ChildProcess[]}
 */
function spawn_wp_scripts(command) {
	const bin = path.join(
		__dirname,
		'node_modules',
		'.bin',
		process.platform === 'win32' ? 'wp-scripts.cmd' : 'wp-scripts'
	);
	return WEBPACK_TARGETS.map(function (target) {
		const child = spawn(
			bin,
			[command, target.entry, '--output-path=' + target.output],
			{ cwd: __dirname, stdio: 'inherit' }
		);
		spawned.push(child);
		return child;
	});
}

/** Send every long-running child on its way. Synchronous, so it is safe on exit. */
function kill_spawned() {
	spawned.forEach(function (child) {
		if (!child.killed) child.kill();
	});
}

// Ctrl+C already reaches the children on its own: they are spawned without
// `detached`, so they sit in this process group and get the SIGINT directly.
// What needs handling is gulp itself.
//
// Node terminates on SIGINT by default, but that default is *replaced* the moment
// any listener is attached — the listener runs and the process simply carries on.
// With gulp's file watchers holding the event loop open, that leaves a webpack
// watcher orphaned to init, still emitting into the output directory. Two of those
// accumulated over a couple of days once, and between them they deleted each
// other's content-hashed chunks on every rebuild.
//
// `once`, so a second Ctrl+C during a slow shutdown falls through to Node's
// default and kills things outright rather than re-running this.
[
	{ signal: 'SIGINT', code: 130 },
	{ signal: 'SIGTERM', code: 143 },
].forEach(function (entry) {
	process.once(entry.signal, function () {
		kill_spawned();
		// 128 + signal number, the shell convention, so `npx gulp && ...` chains and
		// CI see an interrupted run rather than a clean one.
		process.exit(entry.code);
	});
});

// Covers every other way out — a task throwing, or an explicit exit elsewhere —
// so a stray watcher is never left behind holding the output directory.
process.on('exit', kill_spawned);

const cleanPaths = [
	'dist/*',
	// 'woocommerce-mkl-pc-extra-price.zip'
];

const folder_name = 'product-configurator-for-woocommerce';

/** Source fragments concatenated into dist/assets/js/product_configurator.js (order matters). */
const productConfiguratorParts = [
	'src/assets/js/product-configurator/parts/pc-globals.js',
	'src/assets/js/product-configurator/parts/pc-iife-open.js',
	'src/assets/js/product-configurator/parts/pc-fe-config.js',
	'src/assets/js/product-configurator/parts/pc-fe-validation.js',
	'src/assets/js/product-configurator/parts/pc-fe-a11y.js',
	'src/assets/js/product-configurator/parts/pc-fe-main.js',
	'src/assets/js/product-configurator/parts/pc-iife-close.js',
	'src/assets/js/product-configurator/parts/pc-utils.js',
];

/*== Clean Dist and Zip ==*/
var options = { allowEmpty: true };

gulp.task('clean', function(done){
	return gulp.src(cleanPaths, options)
	.pipe(plumber(reportError))
	.pipe(clean({force:true}))
	.on('end', done)
});

gulp.task('build-svg-icon-registry', function(cb) {
	exec('node scripts/build-svg-icon-registry.js', { cwd: __dirname }, function(err, stdout, stderr) {
		if (stdout) {
			console.log(stdout);
		}
		if (stderr) {
			console.error(stderr);
		}
		cb(err);
	});
});

gulp.task('move_src', function(done) {
	return gulp.src(
		[
			'src/**',
			'!src/assets/js/product-configurator/parts/**',
		])
		.pipe(plumber(reportError))
		.pipe(gulp.dest('dist'))
		.on('end', done)
})

gulp.task('vendor', function(done){
	return gulp.src('vendor/**')
	.pipe(plumber(reportError))
	.pipe(gulp.dest('dist/vendor'))
	.on('end', done);
});

gulp.task('composer', function(done) {
	return gulp.src('composer.json', { allowEmpty: true })
		.pipe(plumber(reportError))
		.pipe(gulp.dest('dist'))
		.on('end', done);
});

gulp.task('scss', function(done) {
	return gulp.src('src/**/*.scss', { base: 'src', allowEmpty: true })
		.pipe(sourcemaps.init())
		.pipe(plumber(reportError))
		.pipe(sass().on('error', sass.logError))
		.pipe(sourcemaps.write('maps'))
		.pipe(gulp.dest('dist'))
		.on('end', done);

});

gulp.task('concat_js_views', function(done) {
	return gulp.src(['src/assets/js/views/parts/*.js'], { base: 'src', allowEmpty: true })
		// .pipe(sourcemaps.init())
		.pipe( concat( 'configurator.js' ) )
		.pipe( concat.header( 'var PC = PC || {};\nPC.fe = PC.fe || {};\n\nPC.fe.views = PC.fe.views || {};\nPC.options = PC.options || {};\n\n!( function( $, _ ) {\n\n\'use strict\';\n' ) )
		.pipe( concat.footer( '\n} ) ( jQuery, PC._us || window._ );\n' ) )
		.pipe(gulp.dest( 'dist/assets/js/views/' ))
		.pipe(uglify())
		// .pipe(sourcemaps.write('maps'))
		.pipe( rename( { suffix: '.min' } ) )
		.pipe( gulp.dest( 'dist/assets/js/views/' ) )
		.on('end', done);
});

gulp.task('js', function(done) {
	return gulp.src([
		'src/assets/**/*.js',
		'!src/assets/**/*.min.js',
		'!src/assets/js/views/parts/*.js',
		'!src/assets/js/product-configurator/parts/**',
		'!src/assets/js/source/*.js',
		'!src/assets/build/**/*.js',
		'!src/assets/js/vendor/draco/**/*.js',
		'!src/assets/admin/js/generated/**',
	], { base: 'src', allowEmpty: true })
		.pipe(gulp.dest('dist'))
		// .pipe(sourcemaps.init())
		.pipe(uglify())
		// .pipe(sourcemaps.write('maps'))
		.pipe(rename({suffix: '.min'}))
		.pipe(gulp.dest('dist'))
		.on('end', done);
});

gulp.task('concat_product_configurator', function(done) {
	return gulp.src(productConfiguratorParts, { allowEmpty: true })
		.pipe(plumber(reportError))
		.pipe(concat('product_configurator.js'))
		.pipe(gulp.dest('dist/assets/js/'))
		.pipe(uglify())
		.pipe(rename({ suffix: '.min' }))
		.pipe(gulp.dest('dist/assets/js/'))
		.on('end', done);
});

gulp.task('build-webpack', (cb) => {
	const children = spawn_wp_scripts('build');
	let remaining = children.length;
	let failed = null;
	children.forEach((child) => {
		child.on('close', (code) => {
			if (code !== 0 && !failed) {
				failed = new Error('wp-scripts build failed with exit code ' + code);
			}
			if (--remaining === 0) cb(failed);
		});
	});
});

// Long-running: the children keep the event loop alive, and the signal handling
// above is what takes them down again.
gulp.task('watch-webpack', (done) => {
	spawn_wp_scripts('start');
	done();
});

gulp.task('copy-draco-libs', (done) => {
	gulp.src('node_modules/three/examples/jsm/libs/draco/gltf/*')
		.pipe(gulp.dest('src/assets/js/vendor/draco/gltf'))
		.on('end', done);
});

// gulp.task('js_min', function() {
// 	return gulp.src('src/assets/**/*.js', { base: 'src', allowEmpty: true })
// 	.pipe(plumber(reportError))
// 	.pipe(uglify())
// 	.pipe(plumber(reportError))
// 	.pipe(rename({suffix: '.min'}))
// 	.pipe(plumber(reportError))
// 	.pipe(gulp.dest('dist'));
// });


gulp.task('pot', function(done) {
	return gulp.src('src/**/*.php')
		.pipe(plumber(reportError))
		.pipe(wpPot({
			domain: 'product-configurator-for-woocommerce',
			destFile:'product-configurator-for-woocommerce.pot',
			package: 'product-configurator-for-woocommerce',
			bugReport: 'https://github.com/marcusig/woocommerce-product-customizer/issues',
			lastTranslator: '@marcusig',
			team: '@Mklacroix'
		}))
		.pipe(gulp.dest('dist/languages/product-configurator-for-woocommerce.pot'))
		.on('end', done);
});

// gulp.task('pot', function(done) {
// 	done();
	// return gulp.src('src/**/*.php')
	// .pipe(plumber(reportError))
	// // .pipe(sort())
	// .pipe(wpPot({
	// 	domain: 'woocommerce-mkl-product-configurator',
	// 	destFile:'product-configurator-for-woocommerce.pot',
	// 	package: 'product-configurator-for-woocommerce',
	// 	bugReport: 'https://github.com/marcusig/woocommerce-product-customizer/issues',
	// 	lastTranslator: '@marcusig',
	// 	team: '@Mklacroix'
	// }))
	// .pipe(gulp.dest('dist/languages'))
	// .on('end', done);
// });

gulp.task('build', 
	gulp.series(
		'clean',
		'copy-draco-libs',
		'build-svg-icon-registry',
		'move_src',
		'composer',
		'pot',
		'vendor',
		'scss',
		'js',
		'concat_product_configurator',
		'concat_js_views',
		'build-webpack',
		// 'build-fe-3d-draco-loader',
		// 'build-fe-3d-meshopt-loader',
		// 'merge-fe-3d-builds'
	)
);

gulp.task('watch', function() {
	gulp.watch('src/**/*.scss', gulp.parallel('scss'));
	gulp.watch('src/assets/js/views/parts/*.js', gulp.parallel('concat_js_views'));
	gulp.watch('src/assets/js/product-configurator/parts/*.js', gulp.series('concat_product_configurator'));
	gulp.watch( 'src/assets/icons/**/*.svg', gulp.series( 'build-svg-icon-registry' ) );
	// gulp.watch(jsPaths, { interval: 500 }, ['js']);
	gulp.watch(['src/**/*', '!src/assets/build/fe-3d-viewer-entry.asset.php'])
		.on('change', function(path, stats) {
			// console.log(stats);
			var rel = get_relative_file_path(path);
			if ( rel.indexOf('assets/js/product-configurator/parts/') !== -1 ) {
				return;
			}
			console.log('File ' + colorize.cyan(rel) + ' was modified');
			return gulp.src(path, {base: 'src'})
				.pipe(plumber(reportError))
				.pipe(gulp.dest('dist'));
		})
		.on('unlink', function(path) {
			console.log(colorize.cyan(get_relative_file_path(path)) + ' was ' + colorize.red('deleted'));
		});
});

// ran with gulp build
// `npx gulp` is the whole dev environment: a full build, then the file watchers
// and both webpack watchers together. Nothing else needs starting by hand.
gulp.task('default', 
	gulp.series(
		'build', 
		gulp.parallel( 'watch', 'watch-webpack' )
	)
);

// get the relative path of a file in the src folder
var get_relative_file_path = function (path) {
	var path_parts = path.split('src');
	return path_parts[1] || path;
}

// Setup pretty error handling
const reportError = function(error) {
	const lineNumber = (error.lineNumber) ? 'LINE ' + error.lineNumber + ' -- ' : ''
	let report = ''
	const chalk = gutil.colors.white.bgRed

	// Shows a pop when errors
	// notify({
	// 	title: 'Task Failed [' + error.plugin + ']',
	// 	message: lineNumber + 'See console.',
	// 	sound: 'Sosumi' // See: https://github.com/mikaelbr/node-notifier#all-notification-options-with-their-defaults
	// }).write(error)

	report += chalk('GULP TASK:') + ' [' + error.plugin + ']\n'
	report += chalk('PROB:') + ' ' + error.message + '\n'
	if (error.lineNumber) { report += chalk('LINE:') + ' ' + error.lineNumber + '\n' }
	if (error.fileName) { report += chalk('FILE:') + ' ' + error.fileName + '\n' }
	console.error(report)
	// console.log(error)
	// if (!isWatching) process.exit(1)
}

//for normal build
gulp.task('copy_for_zip', function(done) {
	return gulp.src('dist/**')
	.pipe(plumber(reportError))
	.pipe(gulp.dest(folder_name))
	.on('end', done);
	
});

gulp.task('build_zip', function(done) {
	return gulp.src(folder_name + '/**/*', { base : "." })
	.pipe(plumber(reportError))
	.pipe(zip(folder_name + '.zip'))
	.pipe(gulp.dest('.'))
	.on('end', done);
});

gulp.task('clean_zip', function(done) {
	return gulp.src(folder_name, {read: false}).pipe(clean())
	.pipe(plumber(reportError))
	.on('end', done);
});

// Normal zip gulp
gulp.task('zip', gulp.series(
	'build', 
	// 'build-blocks', 
	'copy_for_zip', 'build_zip', 'clean_zip',
	function(done) {
		done();
	}
));


gulp.task('clean_svn', function(done) {
	return gulp.src('../../repository/product-configurator-for-woocommerce/trunk', {read: false}).pipe(clean({force: true}))
	.pipe(plumber(reportError))
	.on('end', done);
});

gulp.task('copy_to_svn', function(done) {
	return gulp.src('dist/**/*')
	.pipe(plumber(reportError))
	.pipe(gulp.dest('../../repository/product-configurator-for-woocommerce/trunk'))
	.on('end', done);	
});

gulp.task('svn',
	gulp.series(
		'build', 'clean_svn', 'copy_to_svn',
		function(done) {
			done();
		}
	)
);
