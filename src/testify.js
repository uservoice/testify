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
const watchedDependencies = {};
const suitesToRun = [];

const runSuites = debounce(() => {
  if (isWatching) console.log('\x1Bc'); // Clear console
  // TODO: Watch requires too?
  document.body.innerHTML = ''; // Clean slate
  const m = new mocha();
  if (config.require) {
    config.require.map(s => {
      m.addFile(path.resolve(s));
    });
  }
  suitesToRun.map(filepath => {
    delete require.cache[filepath];
    m.addFile(filepath);
  });

  try {
    const runner = m.run();
    runner.on('end', () => {
      if (!isWatching) {
        process.exit();
      }
    });
  } catch (e) {
    console.log('errfz');
    if (isWatching) {
      console.log(e.stack);
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
  // Set up watching for non test files
  if (!minimatch(modulePath, testGlob)) {
    const fullPath = require.resolve(modulePath, { paths: [currentDir] });
    if (!watchedDependencies[fullPath] && !fullPath.match(npmMatch)) {
      watchedDependencies[fullPath] = true;
      chokidar.watch(fullPath, { persistent: true }).on('change', () => {
        console.log('asset chg', fullPath, fullPath in require.cache);
        delete require.cache[fullPath];
        runSuites();
      });
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
    observe() {
      return [];
    },
    takeRecords() {
      return [];
    },
  };
};

window.scrollTo = function() {};

// When tests are added or changed, run them
chokidar
  .watch(config.files, {
    persistent: true,
    ignored: npmMatch,
  })
  .on('add', file => {
    if (!includes(suitesToRun, file)) {
      suitesToRun.push(path.resolve(file));
    }
    runSuites();
  })
  .on('change', file => {
    runSuites();
  })
  .on('ready', () => {
    runSuites();
  });
