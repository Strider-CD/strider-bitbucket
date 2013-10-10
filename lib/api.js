
var superagent = require('superagent')

var API = 'https://bitbucket.org/api/1.0/'

module.exports = {
  parseRepo: parseRepo
}

function parseRepo(repo) {
  console.log(repo)
  return {
    id: repo.owner + '/' + repo.slug,
    name: repo.owner + '/' + repo.slug,
    display_name: repo.owner + '/' + repo.name,
    display_url: 'https://bitbucket.com/' + repo.owner + '/' + repo.slug,
    group: repo.owner,
    private: repo.is_private,
    config: {
      auth: { type: 'ssh' },
      scm: repo.scm,
      url: 'bitbucket.com/' + repo.owner + '/' + repo.slug,
      owner: repo.owner,
      repo: repo.slug,
      pull_requests: 'none',
      whitelist: []
    }
  }
}
