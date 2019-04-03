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
  running = true;
  spinner.text = "Starting tests";
  spinner.start();
  const env = path.resolve(__dirname, 'environment');
  const bin = path.resolve('node_modules/mocha/bin/mocha');
  const args = [testGlob, '--file', env];
  if (argv.f) {
    args.push('-g', argv.f);
  }
  if(config.require) {
    config.require.map(f => {
      args.push('--file', f)
    });
  }
  args.push('--color');
  const mocha = spawn(bin, args);
  mocha.stderr.on('data', d => {
    process.stderr.write(String(d));
  })
  mocha.stdout.on('data', d => {
    spinner.stop();
    process.stdout.write(String(d));
  });
  mocha.on('close', () => {
    running = false;
    if (argv.watch) {
      spinner.text = 'Waiting for changes (ctrl+c to exit)\n';
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
