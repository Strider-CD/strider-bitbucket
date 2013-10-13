
var git = require('strider-git/worker')

module.exports = {
  init: function (dirs, cached, account, config, job, done) {
    return done(null, {
      config: config,
      account: account,
      fetch: function (context, done) {
        module.exports.fetch(dirs.data, cached, account, config, job, context, done)
      }
    })
  },
  fetch: function (dest, cached, account, config, job, context, done) {
    if (config.scm !== 'git') {
      return done(new Error('Bitbucket repo is not git... Mercurial will be supported shortly.'))
    }
    if (config.auth.type === 'https' && !config.auth.username) {
      config.auth.username = account.accessToken
      config.auth.password = ''
    }
    git.fetch(dest, cached, config, job, context, done)
  }
}
