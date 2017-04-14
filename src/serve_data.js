'use strict';

var fs = require('fs'),
    path = require('path'),
    zlib = require('zlib');

var clone = require('clone'),
    express = require('express'),
    mbtiles = require('mbtiles');

var utils = require('./utils');

function isGzipped(data) {
  return data[0] === 0x1f && data[1] === 0x8b;
}

function zip(tile, fn) {
  if (tile.isGzipped) {
    return fn();
  }
  zlib.gzip(tile.data, function(err, buffer) {
    if (!err) {
      tile.data = buffer;
      tile.isGzipped = true;
    }
    fn(err);
  });
}

function initZoomRanges(min, max) {
  var ranges = [];
  var value = Math.pow(2, min);
  var i;

  for (i = min; i <= max; i++) {
    ranges[i] = value;
    value *= 2;
  }

  return ranges;
}

module.exports = function(options, repo, params, id) {
  var app = express().disable('x-powered-by');

  var mbtilesFile = path.resolve(options.paths.mbtiles, params.mbtiles);
  var tileJSON = {
    'tiles': params.domains || options.domains
  };
  var zoomRanges;

  repo[id] = tileJSON;

  var mbtilesFileStats = fs.statSync(mbtilesFile);
  if (!mbtilesFileStats.isFile() || mbtilesFileStats.size === 0) {
    throw Error('Not valid MBTiles file: ' + mbtilesFile);
  }
  var source = new mbtiles(mbtilesFile, function() {
    source.getInfo(function(err, info) {
      tileJSON['name'] = id;
      tileJSON['format'] = 'pbf';

      Object.assign(tileJSON, info);

      tileJSON['tilejson'] = '2.0.0';
      delete tileJSON['filesize'];
      delete tileJSON['mtime'];
      delete tileJSON['scheme'];

      Object.assign(tileJSON, params.tilejson || {});
      utils.fixTileJSONCenter(tileJSON);

      zoomRanges = initZoomRanges(tileJSON.minzoom, tileJSON.maxzoom);
    });
  });

  var tilePattern = '/' + id + '/:z(\\d+)/:x(\\d+)/:y(\\d+).pbf';

  function checkParams(req, res, next) {
    var z = req.params.z | 0,
        x = req.params.x | 0,
        y = req.params.y | 0;

    if (z < tileJSON.minzoom || z > tileJSON.maxzoom
        || x < 0 || x >= zoomRanges[z]
        || y < 0 || y >= zoomRanges[z]) {
      return res.status(404).send('Out of bounds');
    }

    req.params.z = z;
    req.params.x = x;
    req.params.y = y;
    next();
  }

  function getTile(req, res, next) {
    var p = req.params;
    source.getTile(p.z, p.x, p.y, function(err, data, headers) {
      if (err) {
        var status = /does not exist/.test(err.message) ? 404 : 500;
        return res.status(status).send(err.message);
      }
      if (data == null) {
        return res.status(404).send('Not found');
      }
      req.tile = {
        data: data,
        headers: headers,
        contentType: 'application/x-protobuf',
        isGzipped: isGzipped(data)
      };
      next();
    });
  }

  function zipTile(req, res, next) {
    zip(req.tile, next);
  }

  function sendTile(req, res) {
    var headers = req.tile.headers;

    delete headers['ETag']; // do not trust the tile ETag -- regenerate
    headers['Content-Type'] = req.tile.contentType;
    headers['Content-Encoding'] = 'gzip';
    if (req.cacheControl) {
      headers['Cache-Control'] = req.cacheControl;
    }
    res.set(headers);

    res.status(200).send(req.tile.data);
  }

  app.get(tilePattern,
    checkParams,
    getTile,
    zipTile,
    sendTile
  );

  app.get('/' + id + '.json', function(req, res) {
    var info = clone(tileJSON);
    info.tiles = utils.getTileUrls(req, info.tiles,
                                   'data/' + id, info.format, {
                                     'pbf': options.pbfAlias
                                   });
    return res.send(info);
  });

  return app;
};
