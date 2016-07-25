'use strict';

var expect = require('chai').expect;
var sinon = require('sinon');

var webapp = require('../lib/webapp');
describe('webapp', function () {
  var doneStub = null;
  describe('https://github.com/Strider-CD/strider-bitbucket/issues/9', function () {
    beforeEach(function () {
      doneStub = sinon.stub();
    });
    it('getBranch sends an empty array when bitbucket is down', function () {
      webapp.oauth = function () {
        return {
          get: function (url, callback) {
            callback(null, 'not an object!', doneStub);
          }
        };
      };
      webapp.getBranches(null, null, {name: ''}, doneStub);
      expect(doneStub.getCall(0).args[0]).to.eql(null);
      expect(doneStub.getCall(0).args[1]).to.eql([]);
    });
    it('getBranch sends correct data when bitbucket is up', function () {
      webapp.oauth = function () {
        return {
          get: function (url, callback) {
            callback(null, {a: '', b: ''}, doneStub);
          }
        };
      };
      webapp.getBranches(null, null, {name: ''}, doneStub);
      expect(doneStub.getCall(0).args[0]).to.eql(null);
      expect(doneStub.getCall(0).args[1]).to.eql(['a', 'b']);
    });
  });
});
