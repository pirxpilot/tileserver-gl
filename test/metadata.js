const { describe, it } = require('node:test');

require('./setup');

function testTileJSONArray(url) {
  describe(`${url} is array of TileJSONs`, function () {
    it('is json', function (t, done) {
      supertest(app)
        .get(url)
        .expect(200)
        .expect('Content-Type', /application\/json/, done);
    });

    it('is non-empty array', function (t, done) {
      supertest(app)
        .get(url)
        .expect(function (res) {
          res.body.should.be.Array();
          res.body.length.should.be.greaterThan(0);
        }).end(done);
    });
  });
}

function testTileJSON(url) {
  describe(`${url} is TileJSON`, function () {
    it('is json', function (t, done) {
      supertest(app)
        .get(url)
        .expect(200)
        .expect('Content-Type', /application\/json/, done);
    });

    it('has valid tiles', function (t, done) {
      supertest(app)
        .get(url)
        .expect(function (res) {
          res.body.tiles.length.should.be.greaterThan(0);
        }).end(done);
    });
  });
}

describe('Metadata', function () {
  testTileJSONArray('/index.json');
  testTileJSONArray('/data.json');

  testTileJSON('/data/openmaptiles.json');
});
