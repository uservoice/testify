#!/usr/bin/env node

process.env.NODE_ENV = 'test';

const yargs = require('yargs');

yargs.array('require');
yargs.alias('w', 'watch');
yargs.alias('t', 'test-glob');
yargs.alias('r', 'require');

const argv = yargs.argv;

const path = require('path');
const assert = require('assert');
const Module = require('module');

const chai = require('chai');
const sinon = require('sinon');
const jsdom = require('jsdom-global');
const mocha = require('mocha');

const chokidar = require('chokidar');
const minimatch = require('minimatch');
const debounce = require('lodash/debounce');
const includes = require('lodash/includes');
const isFunction = require('lodash/isFunction');

require('ts-node/register');
require('source-map-support/register');

jsdom();

global.chai = chai;
global.sinon = sinon;
global.expect = window.expect = chai.expect;

chai.use(require('sinon-chai'));
chai.use(require('chai-dom'));

const aliases = {};

const requireApi = {
  chai,
  addAlias(alias, actual) {
    aliases[alias] = actual;
  },
};

if (argv.r) {
  argv.r.map(s => {
    const required = require(path.resolve(s));
    if (isFunction(required)) {
      required(requireApi);
    } else if (isFunction(required.default)) {
      required.default(requireApi);
    }
  });
}

let isWatching = argv.watch;
let filesBeingWatched = {};
let suitesToRun = [];

const runSuite = suite => {
  if (!includes(suitesToRun, suite)) {
    suite = path.resolve(suite);
    delete require.cache[suite];
    suitesToRun.push(suite);
  }
};

const watchDependencies = () => {
  suitesToRun = [];
  for (const testFile of Object.keys(watchTargets)) {
    const watchQueue = filesBeingWatched[testFile] || [];
    const filesToWatch = watchTargets[testFile].filter(
      file => !includes(watchQueue, file),
    );
    chokidar.watch(filesToWatch, { persistent: true }).on('change', f => {
      delete require.cache[f];
      runSuite(testFile);
      runSuites();
    });
    filesBeingWatched[testFile] = [...watchQueue, ...filesToWatch];
  }
};

const runSuites = debounce(() => {
  if (isWatching) console.log('\x1Bc'); // Clear console

  const m = new mocha();
  suitesToRun.map(filepath => {
    m.addFile(filepath);
  });

  try {
    const runner = m.run();
    runner.on('end', () => {
      if (isWatching) {
        watchDependencies();
      } else {
        process.exit();
      }
    });
  } catch (e) {
    if (isWatching) {
      console.log(e.stack);
      watchDependencies();
    } else {
      throw e;
    }
  }
});

const genericLoader = () => ({});

const moduleLoaders = {
  css: genericLoader,
  sass: genericLoader,
  scss: genericLoader,
  svg: genericLoader,
  html: genericLoader,
  png: genericLoader,
};

// Monkey-patching the Function prototype so we can have require.ensure working.
Function.prototype.ensure = (_arr, func) => func();

let watchQueue;
const watchTargets = {};

const testGlob = `${process.cwd()}/${argv.t}`;
const npmMatch = /.*node_modules.*/;

// Monkey-patching native require so we can require files other than js
Module.prototype.require = function(modulePath) {
  assert(typeof modulePath === 'string', 'path must be a string');
  assert(modulePath, 'missing path');
  const currentDir = path.dirname(this.filename);
  // Handle aliases
  for (const alias of Object.keys(aliases)) {
    if (modulePath.indexOf(alias) === 0) {
      modulePath = modulePath.replace(alias, path.resolve(aliases[alias]));
      break;
    }
  }
  // If this is a test file
  if (minimatch(modulePath, testGlob)) {
    // Reset the dependency queue
    watchQueue = watchTargets[modulePath] = [];
  } else if (watchQueue) {
    // Collect dependencies
    const fullPath = require.resolve(modulePath, { paths: [currentDir] });
    // Ignore dependencies in node_modules
    if (!fullPath.match(npmMatch)) {
      watchQueue.push(fullPath);
    }
  }
  const extension = path.extname(modulePath).slice(1);

  if (extension in moduleLoaders) {
    return moduleLoaders[extension](currentDir, modulePath);
  }

  return Module._load(modulePath, this);
};

// When tests are added or changed, run them
chokidar
  .watch(argv.t, {
    persistent: true,
    ignored: npmMatch,
  })
  .on('add', file => runSuite(file))
  .on('change', file => {
    runSuite(file);
    runSuites();
  })
  .on('ready', () => runSuites());
