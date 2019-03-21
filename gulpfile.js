const gulp = require('gulp')
// const runSequence = require('run-sequence')
const zip = require('gulp-zip')
const sass = require('gulp-sass');
const colorize = require('chalk');
const clean = require('gulp-clean');
var plumber = require('gulp-plumber');

const cleanPaths = [
	'dist/*',
	// 'woocommerce-mkl-pc-extra-price.zip'
];

const folder_name = 'woocommerce-mkl-product-customizer';

/*== Clean Dist and Zip ==*/
var options = { allowEmpty: true };

gulp.task('clean', function(done){
	return gulp.src(cleanPaths, options)
	.pipe(plumber(reportError))
	.pipe(clean({force:true}))
	.on('end', done)
});

gulp.task('move_src', function(done) {
	return gulp.src(
		[
			'src/**'
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

gulp.task('scss', function(done) {
	return gulp.src('src/assets/**/*.scss', { base: 'src', allowEmpty: true })
		.pipe(plumber(reportError))
		.pipe(sass().on('error', sass.logError))
		.pipe(gulp.dest('dist'))
		.on('end', done);

});

gulp.task('js', function(done) {
	done();
});

gulp.task('pot', function(done) {
	done();
});

gulp.task('build', 
	gulp.series(
		'clean',
		'move_src',
		'vendor',
		'scss',
		'js',
		'pot'
	)
);

gulp.task('watch', function() {
	gulp.watch('src/**/*.scss', gulp.parallel('scss'));
	// gulp.watch(jsPaths, { interval: 500 }, ['js']);
	gulp.watch('src/**/*')
		.on('change', function(path, stats) {
			console.log(stats);
			console.log('File ' + colorize.cyan(get_relative_file_path(path)) + ' was modified');
			return gulp.src(path, {base: 'src'})
				.pipe(plumber(reportError))
				.pipe(gulp.dest('dist'));
		})
		.on('unlink', function(path) {
			console.log(colorize.cyan(get_relative_file_path(path)) + ' was ' + colorize.red('deleted'));
		});
});

// ran with gulp build
gulp.task('default', 
	gulp.series(
		'build', 'watch'
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
	notify({
		title: 'Task Failed [' + error.plugin + ']',
		message: lineNumber + 'See console.',
		sound: 'Sosumi' // See: https://github.com/mikaelbr/node-notifier#all-notification-options-with-their-defaults
	}).write(error)

	report += chalk('GULP TASK:') + ' [' + error.plugin + ']\n'
	report += chalk('PROB:') + ' ' + error.message + '\n'
	if (error.lineNumber) { report += chalk('LINE:') + ' ' + error.lineNumber + '\n' }
	if (error.fileName) { report += chalk('FILE:') + ' ' + error.fileName + '\n' }
	console.error(report)
	// console.log(error)
	if (!isWatching) process.exit(1)
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
	'copy_for_zip', 'build_zip', 'clean_zip',
	function(done) {
		done();
	}
));
