#!/usr/bin/env node

const path = require('path');
const ms = require('ms');

const packageJson = require('../package');

const opts = require('nomnom')
  .option('mbtiles', {
    help: 'MBTiles file - ignored if the configuration file is also specified',
    position: 0
  })
  .option('config', {
    abbr: 'c',
    default: 'config.json',
    help: 'Configuration file'
  })
  .option('bind', {
    abbr: 'b',
    help: 'Bind address'
  })
  .option('port', {
    abbr: 'p',
    default: 8080,
    help: 'Port'
  })
  .option('max-age', {
    help: 'Configue max-age for Cache-Control header: "5d", "3h", "1y" etc.'
  })
  .option('verbose', {
    abbr: 'V',
    flag: true,
    help: 'More verbose output'
  })
  .option('version', {
    abbr: 'v',
    flag: true,
    help: 'Version info',
    callback() {
      return `${packageJson.name} v${packageJson.version}`;
    }
  }).parse();


console.log(`Starting ${packageJson.name} v${packageJson.version}`);

function startServer(configPath) {
  const maxAge = opts['max-age'];
  let cacheControl;

  if (maxAge) {
    cacheControl = `public, max-age=${Math.floor(ms(maxAge) / 1000)}`;
  }
  return require('./server')({
    configPath,
    bind: opts.bind,
    port: opts.port,
    maxAge,
    cacheControl
  });
}

startServer(path.resolve(opts.config));
