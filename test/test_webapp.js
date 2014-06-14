var webapp = require('../webapp');

describe('webapp', function() {
  describe("https://github.com/Strider-CD/strider-bitbucket/issues/9", function() {
    it("wont crash the app when loading the config page", function() {
      webapp.oauth = function(){
        return {
          get: function(url, callback) { callback(null, 'not an object!') }
        }
      };
      webapp.getBranches(null, null, {name: ""}, null)
    });
  })
});
