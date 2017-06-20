'use strict';

var lint = require('./_lint');

//////////////////////////////
// SCSS syntax tests
//////////////////////////////
describe('accessibility-issues - scss', function () {
  var file = lint.file('accessibility-issues.scss');

  it('accessibility issues - full test - scss', function (done) {
    lint.test(file, {
      'accessibility-issues': 1
    }, function (data) {
      lint.assert.equal(16, data.warningCount);
      done();
    });
  });

});

//////////////////////////////
// Sass syntax tests
//////////////////////////////
describe('accessibility-issues - sass', function () {
  var file = lint.file('accessibility-issues.sass');

  it('accessibility issues - full test - sass', function (done) {
    lint.test(file, {
      'accessibility-issues': 1
    }, function (data) {
      lint.assert.equal(16, data.warningCount);
      done();
    });
  });

});

