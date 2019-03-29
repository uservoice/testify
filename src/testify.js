#!/usr/bin/env node

process.env.NODE_ENV = 'test';

const cosmiconfig = require('cosmiconfig');
const cosmi = cosmiconfig('testify').searchSync();

if (!cosmi || !cosmi.config) {
  throw new Error('[Testify] No config found!');
}

const { config } = cosmi;

const yargs = require('yargs');
yargs.alias('w', 'watch');

const argv = yargs.argv;

const path = require('path');
const fs = require('fs');
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

const tsNode = require('ts-node');

tsNode.register({
  transpileOnly: true,
  skipProject: true,
});

require('source-map-support/register');

jsdom('', {
  url: 'http://localhost',
});

global.chai = chai;
global.sinon = sinon;
global.expect = chai.expect;
global.assert = chai.assert;

chai.use(require('sinon-chai'));
chai.use(require('chai-dom'));

let isWatching = argv.watch;
let filesBeingWatched = {};
let suitesToRun = [];

const runSuite = suite => {
  if (!includes(suitesToRun, suite)) {
    suite = path.resolve(suite);
    delete require.cache[suite];
    suitesToRun.push(suite);
  } else {
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
  //if (isWatching) console.log('\x1Bc'); // Clear console
  const m = new mocha();

  if (config.require) {
    config.require.map(s => {
      m.addFile(path.resolve(s));
    });
  }

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
const textLoader = (parentDir, pathToFile) => {
  return fs.readFileSync(pathToFile).toString();
};

const moduleLoaders = {
  css: genericLoader,
  sass: genericLoader,
  scss: genericLoader,
  svg: textLoader,
  html: textLoader,
  png: genericLoader,
};

// Monkey-patching the Function prototype so we can have require.ensure working.
Function.prototype.ensure = (_arr, func) => func();

let watchQueue;
const watchTargets = {};

const testGlob = `${process.cwd()}/${config.files}`;
const npmMatch = /.*node_modules.*/;

// Monkey-patching native require so we can require files other than js
Module.prototype.require = function(modulePath) {
  assert(typeof modulePath === 'string', 'path must be a string');
  assert(modulePath, 'missing path');
  const currentDir = path.dirname(this.filename);
  if (config.alias) {
    const aliases = config.alias;
    for (const alias of Object.keys(aliases)) {
      if (new RegExp('^(' + alias + '$|' + alias + '/)').test(modulePath)) {
        modulePath = modulePath.replace(alias, path.resolve(aliases[alias]));
        break;
      }
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

// Polyfills

global.MutationObserver = function MutationObserver() {
  // https://github.com/tmpvar/jsdom/issues/639
  return {
    observe: function() {
      return [];
    },
    takeRecords: function() {
      return [];
    },
  };
};

// When tests are added or changed, run them
chokidar
  .watch(config.files, {
    persistent: true,
    ignored: npmMatch,
  })
  .on('add', file => runSuite(file))
  .on('change', file => {
    runSuite(file);
    runSuites();
  })
  .on('ready', () => runSuites());
