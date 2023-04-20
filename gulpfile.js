import gulp from 'gulp';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { createRequire } from 'module';
import { deleteAsync } from 'del';
const require = createRequire(import.meta.url);
const packageJson = require('./package.json');

const watchDelay = (packageJson.devSettings ? packageJson.devSettings.watchDelay : undefined) || 3000;

const argv = {
  buildpart: 'build',
};

const version = [packageJson.version, '⎇'];
/**
 * Cleans build
 */
gulp.task('clean', function () {
  return deleteAsync(`${argv.buildpart}`);
});

/**
 * Cleans build
 */
gulp.task('clean-clients', function () {
  return deleteAsync('clients/build');
});
/**
 * Preparation of the configuration file .clasp.json
 */
gulp.task('preparation-clasp-json', function preparationClaspJson() {
  return gulp.src(`./settings/${argv.part}/.clasp.json`).pipe(gulp.dest('./'));
});

/**
 * Preparation of assets files
 */
gulp.task('preparation-assets', function preparationAssets() {
  return gulp
    .src(`./settings/${argv.part}/assets/**/*.{ts,js,gs,json,html}`, {
      base: `./settings/${argv.part}/assets`,
    })
    .pipe(gulp.dest(`${argv.buildpart}/_assets`));
});

/**
 * The prebuild action
 */
gulp.task('pre-build', function preBuild() {
  return gulp.src('./src/**/*.{ts,js,gs,json,html}').pipe(gulp.dest(`./${argv.buildpart}`));
});

/**
 * Runs clasp
 */
gulp.task('clasp', function (cb) {
  cb = cb || console.log;
  const cmd = spawn('./node_modules/.bin/clasp', ['push'], {
    stdio: 'inherit',
  });
  cmd.on('close', function (code) {
    console.log('clasp exited with code ' + code);
    cb(code);
  });
});

gulp.task('preparation-update-client-code', function (cb) {
  return gulp.src('./clients/src/**/*.{ts,js,gs,json,html}').pipe(gulp.dest('./clients/build'));
});

gulp.task('preparation-update-clients', function (cb) {
  let version = '';
  const cmd = spawn('./node_modules/.bin/clasp', ['versions'], {
    stdio: 'pipe',
  });
  cmd.stdout.on('data', function (data) {
    if (version === '') {
      const match = data.toString().match(/^(\d+).+?-/);
      if (match && match.length) version = match[1];
    }
  });
  cmd.on('close', function (code) {
    console.log(`clasp exit code: ${code}.`, `Version detected: ${version}`);
    const appscript = JSON.parse(fs.readFileSync('./clients/src/appsscript.json'));
    const claspjson = JSON.parse(fs.readFileSync('./.clasp.json'));
    const index = appscript.dependencies.libraries.findIndex((lib) => lib.userSymbol === 'Library');
    // console.log(`Lib is ${!~index ? 'NOT ' : ''}DETECTED`);
    appscript.dependencies.libraries[index].version = version;
    appscript.dependencies.libraries[index].libraryId = claspjson.scriptId;
    appscript.dependencies.libraries[index].developmentMode = Object.prototype.hasOwnProperty.call(
      argv,
      'developmentMode',
    );

    // fs.mkdirSync('./clients/build', { recursive: true });
    fs.writeFileSync('./clients/build/appsscript.json', JSON.stringify(appscript, null, '  '), { flag: 'w' });
    cb(code);
  });
});

gulp.task('update-clients-bulk', function (cb) {
  const projects = JSON.parse(
    /start[\s\S]*?`([\s\S]+?)`[\s\S]*?end/.exec(fs.readFileSync(`./settings/${argv.part}/assets/index.js`))[1],
  );
  // cb(projects);
  const clientsList = argv['clients-list'] ? JSON.parse(`[${argv['clients-list']}]`) : undefined;
  const tasks = projects.projects
    .map((project) => (_cb_) => {
      // _cb_ = _cb_ || console.log;

      const claspjson = {
        scriptId: project.projectId,
      };
      fs.writeFileSync('./clients/build/.clasp.json', JSON.stringify(claspjson));
      console.log(project);
      // cb(0);
      const cmd = spawn('./../../node_modules/.bin/clasp', ['push', '--force'], {
        stdio: 'inherit',
        cwd: './clients/build',
      });
      cmd.on('close', function (code) {
        console.log('clasp exited with code ' + code);
        _cb_(code);
      });
    })
    .filter(
      (_, i) =>
        !clientsList ||
        clientsList.includes(projects.projects[i].stage) ||
        clientsList.includes(projects.projects[i].container) ||
        clientsList.includes(projects.projects[i].projectId),
    );
  console.log(tasks);
  return gulp.series(...tasks)(cb);
});

/**
 * Attention! Changes global `version` object
 */
gulp.task('update-version', async function (cb) {
  version.splice(2);
  const abbrevRef = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    stdio: 'pipe',
  });

  const short = spawn('git', ['rev-parse', '--short', 'HEAD'], {
    stdio: 'pipe',
  });

  for await (const data of abbrevRef.stdout) version.push(data.toString().replace(/[\r\n]/g, ''));
  for await (const data of short.stdout) version.push(data.toString().replace(/[\r\n]/g, ''));
  return cb(0);
});

gulp.task('push-version', function (cb) {
  const namedVersion = argv['push-version'] ? `${argv['push-version']}` : '';
  const versionStr = `${version.join(' ')} ${namedVersion}`;

  spawn('clasp', ['version', versionStr], {
    stdio: 'pipe',
  })
    .stdout.on('data', (data) => console.info(data.toString().replace(/[\r\n]/g, '')))
    .on('close', () => {
      console.info(`${versionStr} is pushed.`);
      cb(0);
    });
});

// ======================================================================

gulp.task('bulk', function (cb) {
  const projects = JSON.parse(fs.readFileSync('./scripts/projects.json'));
  const tasks = projects.projects.map((project) => (_cb_) => {
    _cb_ = _cb_ || console.log;
    const claspjson = {
      scriptId: project.projectId,
    };
    fs.writeFileSync('./scripts/src/.clasp.json', JSON.stringify(claspjson));
    console.log(project.projectId);
    const cmd = spawn('./../../node_modules/.bin/clasp', ['push'], {
      stdio: 'inherit',
      cwd: './scripts/src',
    });
    cmd.on('close', function (code) {
      console.log('clasp exited with code ' + code);
      _cb_(code);
    });
  });
  console.log(tasks);
  return gulp.series(...tasks)(cb);
});

gulp.task('readversion', function (cb) {
  let version = '';
  cb = cb || console.log;
  const cmd = spawn('./node_modules/.bin/clasp', ['versions'], {
    stdio: 'pipe',
  });
  cmd.stdout.on('data', function (data) {
    if (version === '') {
      const match = data.toString().match(/^(\d+).+?-/);
      if (match && match.length) version = match[1];
    }
  });
  cmd.on('close', function (code) {
    console.log('clasp exited with code ' + code, version);
    const appscript = JSON.parse(fs.readFileSync('./scripts/src/appsscript.json'));
    const index = appscript.dependencies.libraries.findIndex((lib) => lib.userSymbol === 'Luxcom');
    console.log(`Lib is ${!~index ? 'NOT ' : ''}DETECTED`);
    appscript.dependencies.libraries[index].version = version;
    fs.writeFileSync('./scripts/src/appsscript.json', JSON.stringify(appscript, null, '  '));
    cb(code);
  });
});

gulp.task('update-clients', gulp.series('readversion', 'bulk'));

gulp.task('readversion-prod', function (cb) {
  let version = '';
  cb = cb || console.log;
  const cmd = spawn('./node_modules/.bin/clasp', ['versions'], {
    stdio: 'pipe',
  });

  cmd.stdout.on('data', function (data) {
    if (version === '') {
      const match = data.toString().match(/^(\d+).+?-/);
      if (match && match.length) version = match[1];
    }
  });
  cmd.on('close', function (code) {
    console.log('clasp exited with code ' + code, version);
    const appscript = JSON.parse(fs.readFileSync('./scripts/src/appsscript.json'));
    console.info(appscript);
    const index = appscript.dependencies.libraries.findIndex((lib) => lib.userSymbol === 'Luxcom');
    appscript.dependencies.libraries[index].version = version;
    appscript.dependencies.libraries[index].libraryId = '1fRodYEJFBC3jTabfNabvAUglQo2FxtkZLkQL7I4ulgi1OMZpJLJV8NBu';
    fs.writeFileSync('./scripts/src/appsscript.json', JSON.stringify(appscript, null, '  '));
    cb(code);
  });
});

gulp.task('start', function (done) {
  process.argv.forEach((arg) => {
    const match = /^-+(.+?)(=.+?)?$/.exec(arg);
    if (match) argv[match[1]] = match[2] ? match[2].slice(1) : undefined;
  });
  console.log('Received parameters', argv);
  if (!argv.part) done('"part" arg is requeried');
  const seriesList = ['clean', 'preparation-clasp-json', 'preparation-assets', 'pre-build'];
  if (Object.prototype.hasOwnProperty.call(argv, 'push-version'))
    seriesList.push('clasp', 'update-version', 'push-version');

  if (Object.prototype.hasOwnProperty.call(argv, 'update-clients')) {
    seriesList.push(
      'clean-clients',
      'preparation-update-client-code',
      'preparation-update-clients',
      'update-clients-bulk',
    );

    const updateClientsvSeries = () => gulp.series(seriesList);
    console.log('update-clients');
    return updateClientsvSeries()(done);
  }

  if (!seriesList.includes('clasp')) seriesList.push('clasp');
  const buildSeries = () => gulp.series(seriesList);
  return Object.prototype.hasOwnProperty.call(argv, 'watch_mode')
    ? gulp.watch(
        ['./src/**/*.{ts,js,gs,json,html}', './settings/**/*.{ts,js,gs,json,html}'],
        { delay: watchDelay },
        buildSeries(),
      )
    : buildSeries()(done);
});
