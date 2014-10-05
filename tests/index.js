'use strict';

var fs = require('fs');
var path = require('path');
var expect = require('expect.js');
var RSVP = require('rsvp');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var root = process.cwd();
var broccoli = require('broccoli');

var cachingWriter = require('..');

var builder;

describe('broccoli-caching-writer', function(){
  var sourcePath = 'tests/fixtures/sample-project';
  var existingJSFile = sourcePath + '/core.js';
  var dummyChangedFile = sourcePath + '/dummy-changed-file.txt';
  var dummyJSChangedFile = sourcePath + '/dummy-changed-file.js';

  afterEach(function() {
    if (builder) {
      builder.cleanup();
    }

    if (fs.existsSync(dummyChangedFile)) {
      fs.unlinkSync(dummyChangedFile);
    }

    if (fs.existsSync(dummyJSChangedFile)) {
      fs.unlinkSync(dummyJSChangedFile);
    }

    fs.writeFileSync(existingJSFile, '"YIPPIE"\n');
  });

  describe('write', function() {
    it('calls updateCache when there is no cache', function(){
      var updateCacheCalled = false;
      var tree = cachingWriter(sourcePath, {
        updateCache: function() {
          updateCacheCalled = true;
        }
      });

      builder = new broccoli.Builder(tree);
      return builder.build().finally(function() {
        expect(updateCacheCalled).to.be.ok();
      });
    });

    it('is provided a source and destination directory', function(){
      var updateCacheCalled = false;
      var tree = cachingWriter(sourcePath, {
        updateCache: function(srcDir, destDir) {
          expect(fs.statSync(srcDir).isDirectory()).to.be.ok();
          expect(fs.statSync(destDir).isDirectory()).to.be.ok();
        }
      });

      builder = new broccoli.Builder(tree);
      return builder.build()
    });

    it('only calls updateCache once if input is not changing', function(){
      var updateCacheCount = 0;
      var tree = cachingWriter(sourcePath, {
        updateCache: function() {
          updateCacheCount++;
        }
      });

      builder = new broccoli.Builder(tree);
      return RSVP.all([builder.build(), builder.build(), builder.build()])
        .then(function() {
          expect(updateCacheCount).to.eql(1);
        });
    });

    it('calls updateCache again if input is changed', function(){
      var updateCacheCount = 0;
      var tree = cachingWriter(sourcePath, {
        updateCache: function() {
          updateCacheCount++;
        }
      });

      builder = new broccoli.Builder(tree);

      return builder.build()
        .finally(function() {
          expect(updateCacheCount).to.eql(1);
        })
        .then(function() {
          fs.writeFileSync(dummyChangedFile, 'bergh');

          return RSVP.all([
              builder.build(),
              builder.build(),
              builder.build()
            ])
        })
        .finally(function() {
          expect(updateCacheCount).to.eql(2);
        });
    });

    it('calls updateCache again if existing file is changed', function(){
      var updateCacheCount = 0;
      var tree = cachingWriter(sourcePath, {
        updateCache: function() {
          updateCacheCount++;
        }
      });

      builder = new broccoli.Builder(tree);

      return builder.build()
        .finally(function() {
          expect(updateCacheCount).to.eql(1);
        })
        .then(function() {
          fs.writeFileSync(existingJSFile, '"YIPPIE"\n"KI-YAY"\n');

          return RSVP.all([
              builder.build(),
              builder.build(),
              builder.build()
            ])
        })
        .finally(function() {
          expect(updateCacheCount).to.eql(2);
        });
    });

    it('does not call updateCache again if input is changed but filtered from cache (via exclude)', function(){
      var updateCacheCount = 0;
      var tree = cachingWriter(sourcePath, {
        updateCache: function() {
          updateCacheCount++;
        },
        filterFromCache: {
          exclude: [/.*\.txt$/]
        }
      });

      builder = new broccoli.Builder(tree);

      return builder.build()
        .finally(function() {
          expect(updateCacheCount).to.eql(1);
        })
        .then(function() {
          fs.writeFileSync(dummyChangedFile, 'bergh');

          return RSVP.all([
              builder.build(),
              builder.build(),
              builder.build()
            ]);
        })
        .finally(function() {
          expect(updateCacheCount).to.eql(1);
        });
    });

    it('does not call updateCache again if input is changed but filtered from cache (via include)', function(){
      var updateCacheCount = 0;
      var tree = cachingWriter(sourcePath, {
        updateCache: function() {
          updateCacheCount++;
        },
        filterFromCache: {
          include: [/.*\.js$/]
        }
      });

      builder = new broccoli.Builder(tree);

      return builder.build()
        .finally(function() {
          expect(updateCacheCount).to.eql(1);
        })
        .then(function() {
          fs.writeFileSync(dummyChangedFile, 'bergh');

          return RSVP.all([
              builder.build(),
              builder.build(),
              builder.build()
            ]);
        })
        .finally(function() {
          expect(updateCacheCount).to.eql(1);
        });
    });

    it('does call updateCache again if input is changed is included in the cache filter', function(){
      var updateCacheCount = 0;
      var tree = cachingWriter(sourcePath, {
        updateCache: function() {
          updateCacheCount++;
        },
        filterFromCache: {
          include: [/.*\.js$/]
        }
      });

      builder = new broccoli.Builder(tree);

      return builder.build()
        .finally(function() {
          expect(updateCacheCount).to.eql(1);
        })
        .then(function() {
          fs.writeFileSync(dummyJSChangedFile, 'bergh');

          return RSVP.all([
              builder.build(),
              builder.build(),
              builder.build()
            ]);
        })
        .finally(function() {
          expect(updateCacheCount).to.eql(2);
        });
    });
  });

  describe('updateCache', function() {
    it('can write files to destDir, and they will be in the final output', function(){
      var tree = cachingWriter(sourcePath, {
        updateCache: function(srcDir, destDir) {
          fs.writeFileSync(destDir + '/something-cool.js', 'zomg blammo', {encoding: 'utf8'});
        }
      });

      builder = new broccoli.Builder(tree);
      return builder.build().then(function(dir) {
        expect(fs.readFileSync(dir + '/something-cool.js', {encoding: 'utf8'})).to.eql('zomg blammo');
      });
    });

    it('throws an error if not overriden', function(){
      var tree = cachingWriter(sourcePath);

      builder = new broccoli.Builder(tree);
      return builder.build()
        .catch(function(reason) {
          expect(reason.message).to.eql('You must implement updateCache.');
        });
    });

    it('can return a promise that is resolved', function(){
      var thenCalled = false;
      var tree = cachingWriter(sourcePath, {
        updateCache: function(srcDir, destDir) {
          return {then: function(callback) {
            thenCalled = true;
            callback();
          }};
        }
      });

      builder = new broccoli.Builder(tree);
      return builder.build().then(function() {
        expect(thenCalled).to.be.ok();
      });
    });
  });

  describe('shouldBeIgnored', function() {
    var tree;

    beforeEach(function() {
      tree = cachingWriter(sourcePath);
    });

    it('returns true if the path is included in an exclude filter', function() {
      tree.filterFromCache.exclude = [ /.foo$/, /.bar$/ ];

      expect(tree.shouldBeIgnored('blah/blah/blah.foo')).to.be.ok();
      expect(tree.shouldBeIgnored('blah/blah/blah.bar')).to.be.ok();
      expect(tree.shouldBeIgnored('blah/blah/blah.baz')).to.not.be.ok();
    });

    it('returns false if the path is included in an include filter', function() {
      tree.filterFromCache.include = [ /.foo$/, /.bar$/ ];

      expect(tree.shouldBeIgnored('blah/blah/blah.foo')).to.not.be.ok();
      expect(tree.shouldBeIgnored('blah/blah/blah.bar')).to.not.be.ok();
    });

    it('returns true if the path is not included in an include filter', function() {
      tree.filterFromCache.include = [ /.foo$/, /.bar$/ ];

      expect(tree.shouldBeIgnored('blah/blah/blah.baz')).to.be.ok();
    });

    it('returns false if no patterns were used', function() {
      expect(tree.shouldBeIgnored('blah/blah/blah.baz')).to.not.be.ok();
    });

    it('uses a cache to ensure we do not recalculate the filtering on subsequent attempts', function() {
      expect(tree.shouldBeIgnored('blah/blah/blah.baz')).to.not.be.ok();

      // changing the filter mid-run should have no result on
      // previously calculated paths
      tree.filterFromCache.include = [ /.foo$/, /.bar$/ ];

      expect(tree.shouldBeIgnored('blah/blah/blah.baz')).to.not.be.ok();
    });
  });
});
