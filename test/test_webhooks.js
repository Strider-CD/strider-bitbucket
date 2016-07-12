
var expect = require('expect.js')
  , api = require('../lib/api.js')
  , gravatar = require('gravatar')

describe('The Webhooks parsing', function () {
  var payload = require('./example_post')
  describe('.parseHook(payload)', function () {
    it('should parse an example', function () {
      expect(api.parseCommitData(payload)).to.eql({
        trigger: {
          type: 'commit',
          author: {
            name: 'Jared Forsyth',
            email: 'jabapyth+bitbucket@gmail.com',
            image: gravatar.url('jabapyth+bitbucket@gmail.com', {}, true)
          },
          url: 'https://bitbucket.org/jaredly/tester/commits/0fa628b2b56c48f937e9c375f555a5870faaa8fe',
          message: 'package.json edited online with Bitbucket',
          timestamp: '2013-11-06 00:29:04',
          source: {
            type: 'plugin',
            plugin: 'bitbucket'
          }
        },
        deploy: true,
        branch: 'master',
        ref: {
          branch: 'master',
          id: '0fa628b2b56c48f937e9c375f555a5870faaa8fe'
        }
      })
    })
  })
})
