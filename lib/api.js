
var superagent = require('superagent')

var API = 'https://bitbucket.org/api/1.0/'

module.exports = {
  parseRepo: parseRepo
}

function parseRepo(repo) {
  return {
    id: repo.owner + '/' + repo.slug,
    name: repo.owner + '/' + repo.slug,
    display_name: repo.owner + '/' + repo.slug,
    display_url: 'https://bitbucket.com/' + repo.owner + '/' + repo.slug,
    group: repo.owner,
    private: repo.is_private,
    config: {
      auth: { type: 'ssh' },
      scm: repo.scm,
      url: 'git://bitbucket.com/' + repo.owner + '/' + repo.slug,
      owner: repo.owner,
      repo: repo.slug,
      pull_requests: 'none',
      whitelist: []
    }
  }
}

function setWebhooks() {
  superagent.post('https://api.bitbucket.org/1.0/repositories/' + repo.owner + '/' + repo.slug + '/services/')
    .send({
      type: 'POST',
      url: 'theplacetogo'
    })
}
