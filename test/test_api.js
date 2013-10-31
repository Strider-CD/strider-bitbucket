
var expect = require('expect.js')
  , api = require('../lib/api.js')

describe('The Bitbucket API', function () {
  describe('.parseRepo(repo)', function () {
    var repo = require('./example_repo')
    it('should parse an example repo', function () {
      expect(api.parseRepo(repo)).to.eql({
        id: '1team/justdirectteam',
        name: '1team/justdirectteam',
        display_name: '1team/justdirectteam',
        display_url: 'https://bitbucket.com/1team/justdirectteam',
        group: '1team',
        private: true,
        config: {
          auth: {type: 'ssh'},
          scm: 'git',
          url: 'git://bitbucket.com/1team/justdirectteam',
          owner: '1team',
          repo: 'justdirectteam',
          pull_requests: 'none',
          whitelist: []
        }
      })
    })
  })
})
