
var git = require('strider-git/worker')

module.exports = {
  init: function (dest, account, config, job, done) {
    return done(null, {
      config: config,
      account: account,
      fetch: function (context, done) {
        module.exports.fetch(dest, account, config, job, context, done)
      }
    })
  },
  fetch: function (dest, account, config, job, context, done) {
    if (config.scm !== 'git') {
      return done(new Error('Bitbucket repo is not git... Other SCMs will be supported shortly.'))
    }
    if (config.auth.type === 'https' && !config.auth.username) {
      config.auth.username = account.accessToken
      config.auth.password = ''
    }
    git.fetch(dest, null, config, job, context, done)
  }
}
