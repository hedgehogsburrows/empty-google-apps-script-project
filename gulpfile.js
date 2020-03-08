'use strict';
const gulp = require('gulp');
const spawn = require('child_process').spawn;
const del = require('del');
const packageJson = require('./package.json');

const watchDelay =
  (packageJson.devSettings ? packageJson.devSettings.watchDelay : undefined) ||
  3000;

/**
 * Cleans build
 */
gulp.task('clean', function() {
  return del('build');
});

/**
 * Runs clasp
 */
gulp.task('clasp', function(cb) {
  cb = cb || console.log;
  const cmd = spawn('./node_modules/.bin/clasp', ['push'], {
    stdio: 'inherit'
  });
  cmd.on('close', function(code) {
    console.log('clasp exited with code ' + code);
    cb(code);
  });
});

gulp.task('devPrep', function devPrep() {
  return gulp.src('./settings/dev/.clasp.json').pipe(gulp.dest('./'));
});

gulp.task('devassets', function devPrep() {
  return gulp
    .src('./settings/dev/assets/**/*.{ts,js,gs,json,html}', {
      base: './settings/dev/assets'
    })
    .pipe(gulp.dest('build/_assets'));
});

gulp.task('prodassets', function devPrep() {
  return gulp
    .src('./settings/prod/assets/**/*.{ts,js,gs,json,html}', {
      base: './settings/prod/assets'
    })
    .pipe(gulp.dest('build/_assets'));
});

gulp.task('buildPrep', function buildPrep() {
  return gulp.src('./settings/prod/.clasp.json').pipe(gulp.dest('./'));
});

gulp.task('preBuild', function devPrep() {
  return gulp.src('./src/**/*.{ts,js,gs,json,html}').pipe(gulp.dest('./build'));
});

/**
 * Dev
 */
gulp.task(
  'dev',
  gulp.series('clean', 'devPrep', 'preBuild', 'devassets', 'clasp')
);

/**
 * Build
 */
gulp.task(
  'build',
  gulp.series('clean', 'buildPrep', 'preBuild', 'prodassets', 'clasp')
);

/**
 * Watcher
 */
gulp.task(
  'watch',
  gulp.series('dev', function watch() {
    gulp.watch(
      [
        './src/**/*.{ts,js,gs,json,html}',
        './settings/**/*.{ts,js,gs,json,html}'
      ],
      { delay: watchDelay },
      gulp.series('dev')
    );
  })
);

/**
 * Watcher
 */
gulp.task(
  'watch-prod',
  gulp.series('build', function watch() {
    gulp.watch(
      [
        './src/**/*.{ts,js,gs,json,html}',
        './settings/**/*.{ts,js,gs,json,html}'
      ],
      { delay: watchDelay },
      gulp.series('build')
    );
  })
);
