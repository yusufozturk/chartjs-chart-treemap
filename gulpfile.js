/* global Promise */

var eslint = require('gulp-eslint');
var {exec} = require('child_process');
var gulp = require('gulp');
var file = require('gulp-file');
var replace = require('gulp-replace');
var streamify = require('gulp-streamify');
var zip = require('gulp-zip');
var karma = require('karma');
var merge = require('merge2');
var path = require('path');
var yargs = require('yargs');
var pkg = require('./package.json');

var argv = yargs
	.option('output', {alias: 'o', default: 'dist'})
	.option('samples-dir', {default: 'samples'})
	.argv;

function run(bin, args) {
	return new Promise((resolve, reject) => {
		var exe = '"' + process.execPath + '"';
		var src = require.resolve(bin);
		var ps = exec([exe, src].concat(args || []).join(' '));

		ps.stdout.pipe(process.stdout);
		ps.stderr.pipe(process.stderr);
		ps.on('close', (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

gulp.task('build', function() {
	return run('rollup/dist/bin/rollup', ['-c', argv.watch ? '--watch' : '']);
});


gulp.task('test', function(done) {
	new karma.Server({
		configFile: path.join(__dirname, 'karma.config.js'),
		singleRun: !argv.watch,
		args: {
			coverage: !!argv.coverage,
			inputs: (argv.inputs || 'test/specs/**/*.js').split(';'),
			watch: argv.watch
		}
	},
	function(error) {
		// https://github.com/karma-runner/gulp-karma/issues/18
		error = error ? new Error('Karma returned with the error code: ' + error) : undefined;
		done(error);
	}).start();
});

gulp.task('lint', function() {
	var files = [
		'samples/**/*.js',
		'src/**/*.js',
		'test/**/*.js',
		'*.js'
	];

	return gulp.src(files)
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
});

gulp.task('samples', function() {
	var out = path.join(argv.output, argv.samplesDir);
	return gulp.src('samples/**/*', {base: 'samples'})
		.pipe(streamify(replace(/src="((?:\.\.\/)+)dist\//g, 'src="$1', {skipBinary: true})))
		.pipe(gulp.dest(out));
});

gulp.task('package', gulp.series(gulp.parallel('build', 'samples'), function() {
	var out = argv.output;
	var streams = merge(
		gulp.src(path.join(out, argv.samplesDir, '**/*'), {base: out}),
		gulp.src([path.join(out, '*.js'), 'LICENSE'])
	);

	return streams
		.pipe(zip(pkg.name + '.zip'))
		.pipe(gulp.dest(out));
}));

gulp.task('bower', function() {
	var json = JSON.stringify({
		name: pkg.name,
		description: pkg.description,
		homepage: pkg.homepage,
		license: pkg.license,
		version: pkg.version,
		main: argv.output + '/' + pkg.name + '.js'
	}, null, 2);

	return file('bower.json', json, {src: true})
		.pipe(gulp.dest('./'));
});

gulp.task('default', gulp.parallel('build'));
