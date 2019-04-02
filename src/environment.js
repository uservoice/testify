const Module = require('module');
const path = require('path');
const chai = require('chai');
const sinon = require('sinon');
const jsdom = require('jsdom-global');
const minimatch = require('minimatch');
const tsNode = require('ts-node');

const cosmiconfig = require('cosmiconfig');
const cosmi = cosmiconfig('testify').searchSync();

if (!cosmi || !cosmi.config) {
  throw new Error('[Testify] No config found!');
}

const { config } = cosmi;

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

const genericLoader = () => ({});
const textLoader = (_parentDir, pathToFile) => {
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

// Monkey-patching native require so we can require files other than js
Module.prototype.require = function(modulePath) {
  assert(typeof modulePath === 'string', 'path must be a string');
  assert(modulePath, 'missing path');
  const aliases = config.alias || [];
  for (const alias of Object.keys(aliases)) {
    if (new RegExp('^(' + alias + '$|' + alias + '/)').test(modulePath)) {
      modulePath = modulePath.replace(alias, path.resolve(aliases[alias]));
      break;
    }
  }
  const extension = path.extname(modulePath).slice(1);

  if (extension in moduleLoaders) {
    return moduleLoaders[extension](modulePath);
  }

  return Module._load(modulePath, this);
};

require('./polyfills');