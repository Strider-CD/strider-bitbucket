
var api = require('./lib/api');
var BitbucketStrategy = require('passport-bitbucket').Strategy;
var OAuth = require('oauth').OAuth;
var API = 'https://bitbucket.org/api/1.0/';

module.exports = {
  appConfig: {
    appKey: 'yxP57RbJNLsCjzvn3p',
    appSecret: 'n65ZnGRkE58AsVfPMKugaPSuWKGXMtTg'
  },

  accountConfig: {
    accessToken: String,
    tokenSecret: String,
    login: String,
    avatar: String,
    name: String
  },

  config: {
    url: String,
    owner: String,
    repo: String,
    scm: String,
    cache: Boolean,
    pull_requests: {type: String, enum: ['all', 'none', 'whitelist']},
    whitelist: [{
      name: String,
      level: {type: String, enum: ['tester', 'admin']}
    }],
    pk: Number,
    secret: String,
    // type: https || ssh
    auth: {}
  },

  // get an oauth manager.
  // -> {get: fn(), post: fn(), del: fn()}
  oauth: function (account) {
    var oauth = new OAuth(
      'https://bitbucket.org/api/1.0/oauth/request_token/',
      'https://bitbucket.org/api/1.0/oauth/access_token/',
      this.appConfig.appKey,
      this.appConfig.appSecret,
      '1.0', null, 'HMAC-SHA1', null, {})
    function parse(done, err, body, res) {
      if (!res) {
        return done(new Error('Invalid oauth response'));
      }

      if (res.headers['content-type'].toLowerCase().indexOf('application/json') === -1) {
        return done(err, body, res)
      }

      var data
      try {
        data = JSON.parse(body)
      } catch (e) {
        return done(new Error('Failed to parse json body: ' + e.message + '; ' + body))
      }
      if ('object' !== typeof data) {
        return done(new Error('Unexpected body format, wanted an object: ' + body))
      }
      done(err, data, res)
    }
    return {
      get: function (url, done) {
        return oauth.get(url, account.accessToken, account.tokenSecret, parse.bind(null, done))
      },
      // also accepts (url, body, done)
      post: function (url, body, contentType, done) {
        return oauth.post(url, account.accessToken, account.tokenSecret, body, contentType, parse.bind(null, done))
      },
      del: function (url, done) {
        return oauth.delete(url, account.accessToken, account.tokenSecret, parse.bind(null, done))
      },
      orig: oauth
    }
  },

  getBranches: function (account, config, project, done) {
    var client = this.oauth(account)
    client.get(API + 'repositories/' + project.name + '/branches', function (err, data, res) {
      if (typeof data === "object") {
        done(null, Object.keys(data))
      } else {
        console.error("bitbucket is down but is sending a 200 anyway");
        done(null, [])
      }
    })
  },

  getFile: function (filename, ref, account, config, project, done) {
    var client = this.oauth(account)
      , url = API + 'repositories/' + project.name + '/raw/' + ref.branch + '/' + filename
    client.get(url, function (err, body, res) {
      if (err && err.statusCode) {
        err.status = err.statusCode;
        delete err.statusCode;
      }
      
      done(err, body);
    })
  },

  fastFile: true,

  setupRepo: function (account, config, project, done) {
    var client = this.oauth(account)
      , url = API + 'repositories/' + project.name + '/deploy-keys'
      , self = this
      , key
    for (var i=0; i<project.branches.length; i++) {
      if (project.branches[i].name === 'master') {
        key = project.branches[i].pubkey.toString()
        break;
      }
    }
    // register keys
    client.post(url, {
      label: 'strider at ' + this.appConfig.hostname,
      key: key
    }, function (err, data, res) {
      if (err) {
        if (err.statusCode === 403) {
          return done(new Error('failed to register public key - user must have admin privileges for this repository'));
        }

        return done(err);
      }

      try {
        data = JSON.parse(data)
      } catch (e) {
        return done(new Error('failed to register public key'))
      }
      config.pk = data.pk
      api.setWebhooks(client, self.appConfig.hostname, project.name, function (err, secret) {
        config.secret = secret
        done(null, config)
      })
    })
  },

  teardownRepo: function (account, config, project, done) {
    var client = this.oauth(account)
      , url = API + 'repositories/' + project.name + '/deploy-keys/' + config.pk
      , self = this
    client.del(url, function (err) {
      api.removeWebhooks(client, self.appConfig.hostname, project.name, function (err, found) {
        // do we give some indication of whether or not there was a webhook to remove?
        done(err)
      })
    })
  },

  listRepos: function (account, next) {
    var client = this.oauth(account)
    listRepos(client, next)
  },

  // namespaced to /org/repo/api/bitbucket/
  routes: function (app, context) {
    // set config based on server_name
    if (!this.appConfig.hostname) {
      this.appConfig.hostname = context.config.server_name
    }
    var self = this
    app.post('hook', function (req, res) {
      var client = this.oauth(req.accountConfig())
      api.setWebhooks(client, self.appConfig.hostname, req.project.name, function (err, secret, already) {
        if (err) return res.status(500).send('Failed to set webhooks')
        var config = req.providerConfig()
        config.secret = secret
        req.providerConfig(config, function (err) {
          if (err) return res.status(500).send('Error saving config')
          res.send(already ? 'Webhooks already existed' : 'Webhooks created')
        })
      })
    })
    app.del('hook', function (req, res) {
      var client = this.oauth(req.accountConfig())
      api.removeWebhooks(client, self.appConfig.hostname, req.project.name, function (err, found) {
        if (err) return res.status(500).send('Failed to remove webhooks')
        res.send(found ? 'Webhooks removed' : 'No webhooks found to remove')
      })
    })
    app.anon.post('commit/:secret', function (req, res) {
      var config = req.providerConfig()
        , data
      if (config.secret !== req.params.secret) return res.status(400).send('Invalid secret')
      try {
        data = JSON.parse(req.body.payload)
      } catch (e) {
        return res.status(400).send('Invalid json payload')
      }
      api.startCommitJob(data, req.project, context.emitter, function (err) {
        if (err) return res.status(500).send('Failed to start job')
        res.sendStatus(204)
      })
    })
    app.anon.post('pull-request/:secret', function (req, res) {
      console.error('Got PR, but not enabled yet')
    })
  },

  globalRoutes: function (app, context) {
    app.get('/oauth', context.passport.authenticate('bitbucket'));
    app.get(
      '/oauth/callback', 
      context.passport.authenticate('bitbucket', { failureRedirect: '/login' }),
      function(req, res) {
        // Successful authentication, redirect home.
        res.redirect('/projects');
      });
  },

  // register the passport auth strategy
  auth: function (passport, context) {
    passport.use(new BitbucketStrategy({
      consumerKey: this.appConfig.appKey,
      consumerSecret: this.appConfig.appSecret,
      callbackURL: this.appConfig.hostname + '/ext/bitbucket/oauth/callback',
      passReqToCallback: true
    }, validateAuth.bind(null, this.oauth.bind(this))));
  },
}

function listRepos(client, next) {
  var url = API + 'user/repositories/'
  client.get(url, function (err, data, req) {
    if (err) return next(err)
      next(null, data.map(api.parseRepo).filter(function (repo) {
        return repo.config.scm === 'git';
      }))
  })
}

function validateAuth(oauth, req, token, tokenSecret, profile, done) {
  if (!req.user) {
    console.warn('Bitbucket OAuth but no logged-in user')
    req.flash('account', "Cannot link a bitbucket account if you aren't logged in")
    return done()
  } 
  var account = req.user.account('bitbucket', profile.username)
  if (account) {
    console.warn("Trying to attach a bitbucket account that's already attached...")
    req.flash('account', 'That bitbucket account is already linked. <a href="https://bitbucket.org/account/signout/" target="_blank">Sign out of bitbucket</a> before you click "Add Account".')
    return done(null, req.user)
  }
  var client = oauth({
    accessToken: token,
    tokenSecret: tokenSecret
  })
  listRepos(client, function (err, repos) {
    if (err) return done(new Error('Failed to get repositories for user'))
    req.user.accounts.push(makeAccount(token, tokenSecret, profile, repos))
    req.user.save(function (err) {
      done(err, req.user);
    })
  })
}

function makeAccount(token, tokenSecret, profile, repos) {
  var username = profile.username
  return {
    provider: 'bitbucket',
    id: profile.username,
    display_url: 'https://bitbucket.com/' + profile.username,
    title: profile.username,
    config: {
      accessToken: token,
      tokenSecret: tokenSecret,
      login: profile.username,
      avatar: profile._json.user.avatar,
      name: profile.displayName
    },
    cache: repos
  }
}
