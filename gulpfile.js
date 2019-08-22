'use strict';
const gulp = require('gulp');
const spawn = require('child_process').spawn;

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

gulp.task(
  'watch',
  gulp.series('clasp', function watch() {
    gulp.watch(['./src/**/*.{js,gs,json,html}'], gulp.series('clasp'));
  })
);
