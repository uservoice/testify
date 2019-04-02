#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { exec, fork, spawn } = require('child_process');

process.env.NODE_ENV = 'test';
process.env.CACHE_REQUIRE_PATHS_FILE = ".testify/require-paths.json";
process.env.NODE_OPTIONS = "--max-old-space-size=4096";

if (!fs.existsSync('.testify')) {
  fs.mkdirSync('.testify');
  exec(`echo '.testify' >> .gitignore`);
}

const cosmiconfig = require('cosmiconfig');
const cosmi = cosmiconfig('testify').searchSync();

if (!cosmi || !cosmi.config) {
  throw new Error('[Testify] No config found!');
}

const { config } = cosmi;

const yargs = require('yargs');
yargs.alias('w', 'watch');
yargs.alias('f', 'filter');

const argv = yargs.argv;

const chokidar = require('chokidar');
const testGlob = `${process.cwd()}/${config.files}`;
const npmMatch = /.*node_modules.*/;

const ora = require('ora');
const spinner = ora('Loading unicorns');
let running = false;

function runTests() {
  console.log('\x1Bc'); // Clear console
  console.log('--')
  running = true;
  spinner.text = "Starting tests";
  spinner.start();
  const env = path.resolve(__dirname, 'environment');
  const bin = path.resolve('node_modules/mocha/bin/mocha');
  const args = [testGlob, '-r', env, ...config.require, '--color'];
  if (argv.f) {
    args.push('-g', argv.f);
  }
  const mocha = spawn(bin, args);
  mocha.stdout.on('data', d => {
    spinner.stop();
    console.log(String(d).replace('\n', ''));
  });
  mocha.on('close', () => {
    running = false;
    if (argv.watch) {
      console.log('\n')
      spinner.text = 'Waiting for changes (ctrl+c to exit)';
      spinner.start();
    } else {
      process.exit(mocha.exitCode);
    }
  });
}

if (argv.watch) {
  chokidar
    .watch(config.src ? [config.files, config.src] : config.files, {
      persistent: true,
      ignored: npmMatch,
    })
    .on('change', file => {
      if (running) {
        return;
      }
      spinner.stop();
      runTests();
    })
}


runTests();