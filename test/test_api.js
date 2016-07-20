var expect = require('chai').expect;
var api = require('../lib/api.js');

describe('The Bitbucket API', function () {
  describe('.parseRepo(repo)', function () {
    var gitrepo = require('./example_repo');
    it('should parse an example git repo', function () {
      expect(api.parseRepo(gitrepo)).to.eql({
        id: '1team/justdirectteam',
        name: '1team/justdirectteam',
        display_name: '1team/justdirectteam',
        display_url: 'https://bitbucket.org/1team/justdirectteam',
        group: '1team',
        private: true,
        config: {
          auth: {type: 'ssh'},
          scm: 'git',
          url: 'ssh://git@bitbucket.org/1team/justdirectteam',
          owner: '1team',
          repo: 'justdirectteam',
          pull_requests: 'none',
          whitelist: []
        }
      });
    });
    var hgrepo = require('./example_hg_repo');
    it('should parse an example hg repo', function () {
      expect(api.parseRepo(hgrepo)).to.eql({
        id: '1team/justdirectteam',
        name: '1team/justdirectteam',
        display_name: '1team/justdirectteam',
        display_url: 'https://bitbucket.org/1team/justdirectteam',
        group: '1team',
        private: true,
        config: {
          auth: {type: 'ssh'},
          scm: 'hg',
          url: 'ssh://hg@bitbucket.org/1team/justdirectteam',
          owner: '1team',
          repo: 'justdirectteam',
          pull_requests: 'none',
          whitelist: []
        }
      });
    });
  });
});
