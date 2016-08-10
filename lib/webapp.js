'use strict';

var api = require('./api');
var BitbucketStrategy = require('passport-bitbucket').Strategy;
var debug = require('debug')('strider-bitbucket:webapp');
var OAuth = require('oauth').OAuth;
var API = 'https://bitbucket.org/api/1.0/';
var API2 = 'https://api.bitbucket.org/2.0/';
var lastCommitHashes = [];

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
      '1.0', null, 'HMAC-SHA1', null, {});

    function parse(done, err, body, res) {
      if (!res) {
        return done(new Error('Invalid oauth response'));
      }

      if (res.headers['content-type'].toLowerCase().indexOf('application/json') === -1) {
        return done(err, body, res);
      }

      var data;
      try {
        data = JSON.parse(body);
      } catch (e) {
        return done(new Error(`Failed to parse json body: ${e.message}; ${body}`));
      }
      if ('object' !== typeof data) {
        return done(new Error(`Unexpected body format, wanted an object: ${body}`));
      }
      done(err, data, res);
    }

    return {
      get: function (url, done) {
        return oauth.get(url, account.accessToken, account.tokenSecret, parse.bind(null, done));
      },
      // also accepts (url, body, done)
      post: function (url, body, contentType, done) {
        return oauth.post(url, account.accessToken, account.tokenSecret, body, contentType, parse.bind(null, done));
      },
      del: function (url, done) {
        return oauth.delete(url, account.accessToken, account.tokenSecret, parse.bind(null, done));
      },
      orig: oauth
    };
  },

  getBranches: function (account, config, project, done) {
    var client = this.oauth(account);
    client.get(`${API}repositories/${project.name}/branches`, function (err, data) {
      if (typeof data === 'object') {
        done(null, Object.keys(data));
      } else {
        debug('Bitbucket is down but is sending a 200 anyway');
        done(null, []);
      }
    });
  },

  getFile: function (filename, ref, account, config, project, done) {
    var client = this.oauth(account);
    var url = `${API}repositories/${project.name}/raw/${ref.branch}/${filename}`;
    client.get(url, function (err, body) {
      if (err && err.statusCode) {
        err.status = err.statusCode;
        delete err.statusCode;
      }

      done(err, body);
    });
  },

  fastFile: true,

  setupRepo: function (account, config, project, done) {
    var client = this.oauth(account);
    var url = `${API}repositories/${project.name}/deploy-keys`;
    var self = this;
    var key;
    for (var i = 0; i < project.branches.length; i++) {
      if (project.branches[i].name === 'master') {
        key = project.branches[i].pubkey.toString();
        break;
      }
    }
    // register keys
    client.post(url, {
      label: `strider at ${this.appConfig.hostname}`,
      key: key
    }, function (err, data) {
      if (err) {
        if (err.statusCode === 403) {
          return done(new Error('failed to register public key - user must have admin privileges for this repository'));
        }

        return done(err);
      }

      try {
        data = JSON.parse(data);
      } catch (e) {
        return done(new Error('failed to register public key'));
      }
      config.pk = data.pk;
      api.setWebhooks(client, self.appConfig.hostname, project.name, function (err, secret) {
        config.secret = secret;
        done(null, config);
      });
    });
  },

  teardownRepo: function (account, config, project, done) {
    var client = this.oauth(account);
    var url = `${API}repositories/${project.name}/deploy-keys/${config.pk}`;
    var self = this;
    client.del(url, function () {
      api.removeWebhooks(client, self.appConfig.hostname, project.name, function (err) {
        // do we give some indication of whether or not there was a webhook to remove?
        done(err);
      });
    });
  },

  listRepos: function (account, next) {
    var client = this.oauth(account);
    listRepos(client, next);
  },

  // namespaced to /org/repo/api/bitbucket/
  routes: function (app, context) {
    // set config based on server_name
    if (!this.appConfig.hostname) {
      this.appConfig.hostname = context.config.server_name;
    }
    var self = this;
    app.post('hook', function (req, res) {
      var client = self.oauth(req.accountConfig());
      api.setWebhooks(client, self.appConfig.hostname, req.project.name, function (err, secret, already) {
        if (err) return res.status(500).send('Failed to set webhooks');
        var config = req.providerConfig();
        config.secret = secret;
        req.providerConfig(config, function (err) {
          if (err) return res.status(500).send('Error saving config');
          res.send(already ? 'Webhooks already existed' : 'Webhooks created');
        });
      });
    });
    app.del('hook', function (req, res) {
      var client = self.oauth(req.accountConfig());
      api.removeWebhooks(client, self.appConfig.hostname, req.project.name, function (err, found) {
        if (err) return res.status(500).send('Failed to remove webhooks');
        res.send(found ? 'Webhooks removed' : 'No webhooks found to remove');
      });
    });

    app.anon.post('commit/:secret', onCommit.bind(self, context));

    app.anon.post('pull-request/:secret', onPullRequest.bind(self, context));
  },

  globalRoutes: function (app, context) {
    app.get('/oauth', context.passport.authenticate('bitbucket'));
    app.get(
      '/oauth/callback',
      context.passport.authenticate('bitbucket', {failureRedirect: '/login'}),
      function (req, res) {
        // Successful authentication, redirect home.
        res.redirect('/projects');
      });
  },

  // register the passport auth strategy
  auth: function (passport) {
    passport.use(new BitbucketStrategy({
      consumerKey: this.appConfig.appKey,
      consumerSecret: this.appConfig.appSecret,
      callbackURL: `${this.appConfig.hostname}/ext/bitbucket/oauth/callback`,
      passReqToCallback: true
    }, validateAuth.bind(null, this.oauth.bind(this))));
  },
};

function listRepos(client, next) {
  debug('Listing repositories...');
  var url = `${API}user/repositories/`;
  client.get(url, function (err, data) {
    if (err) return next(err);
    next(null, data.map(api.parseRepo).filter(function (repo) {
      return (repo.config.scm === 'git') || (repo.config.scm === 'hg');
    }));
  });
}

function validateAuth(oauth, req, token, tokenSecret, profile, done) {
  debug('Validating authentication...');

  if (!req.user) {
    debug('Bitbucket OAuth but no logged-in user');
    req.flash('account', 'Cannot link a Bitbucket account if you aren\'t logged in');
    return done();
  }
  var account = req.user.account('bitbucket', profile.username);
  if (account) {
    debug('Trying to attach a Bitbucket account that\'s already attached...');
    req.flash('account', 'That Bitbucket account is already linked. <a href="https://bitbucket.org/account/signout/" target="_blank">Sign out of Bitbucket</a> before you click "Add Account".');
    return done(null, req.user);
  }
  var client = oauth({
    accessToken: token,
    tokenSecret: tokenSecret
  });

  listRepos(client, function (err, repos) {
    if (err) return done(new Error('Failed to get repositories for user'));
    req.user.accounts.push(makeAccount(token, tokenSecret, profile, repos));
    req.user.save(function (err) {
      done(err, req.user);
    });
  });
}

function makeAccount(token, tokenSecret, profile, repos) {
  debug('Making account...', profile);
  return {
    provider: 'bitbucket',
    id: profile.username,
    display_url: `https://bitbucket.org/${profile.username}`,
    title: profile.username,
    config: {
      accessToken: token,
      tokenSecret: tokenSecret,
      login: profile.username,
      avatar: profile._json.links.avatar,
      name: profile.displayName
    },
    cache: repos
  };
}

/**
 * @param context
 * @param req
 * @param res
 * @return {undefined}
 * @this {module.exports}
 */
function onCommit(context, req, res) {
  var config = req.providerConfig();

  if (config.secret !== req.params.secret) {
    res.status(400).send('Invalid secret');
    return;
  }

  var data;
  try {
    //TODO check json parse (data object)
    data = JSON.parse(req.body.payload);
  } catch (e) {
    res.status(400).send('Invalid json payload');
    return;
  }

  /* jshint validthis: true */
  var client = this.oauth(req.accountConfig());
  var id = data.commits[data.commits.length - 1].raw_node;
  var repositoryFullName = data.repository.absolute_url;
  var projectUrl = `http://${req.headers.host}${repositoryFullName}`;
  var jobInfo = {
    id: id,
    repositoryFullName: repositoryFullName,
    projectUrl: projectUrl,
    trigger: 'commitJob'
  };

  api.resultHandler(client, context.emitter, jobInfo);

  api.startCommitJob(data, req.project, context.emitter, function (err) {
    if (err) {
      res.status(500).send('Failed to start job');
      return;
    }
    res.sendStatus(204);
  });
}


/**
 * @param context
 * @param req
 * @param res
 * @return {undefined}
 * @this {module.exports}
 */
function onPullRequest(context, req, res) {
  var config = req.providerConfig();

  if (config.secret !== req.params.secret) {
    res.status(400).send('Invalid secret');
    return;
  }

  var isPullRequestPrepare = false;
  var data = req.body;

  /* jshint validthis: true */
  var client = this.oauth(req.accountConfig());

  if (!data.pullrequest_updated && !data.pullrequest_created) {
    res.status(501).send('Skipping pull request due to not interesting action');
    return;
  }

  var pullrequest = data.pullrequest_updated || data.pullrequest_created;
  var repositoryFullName = pullrequest.source.repository.full_name;
  var projectUrl = `http://${req.headers.host}/${repositoryFullName}/`;

  if (data.pullrequest_updated) {
    isPullRequestPrepare = onPullRequestUpdated(client, context, pullrequest, repositoryFullName, projectUrl);

  } else if (data.pullrequest_created) {
    isPullRequestPrepare = onPullRequestCreated(client, context, pullrequest, repositoryFullName, projectUrl);
  }

  if (!isPullRequestPrepare) {
    res.status(501).send('Skipping due to doubled hook');
    return;
  }

  api.startPullrequestJob(data, req.project, context.emitter, function (err) {
    if (err) {
      return res.status(500).send('Failed to start job');
    }
    res.sendStatus(204);
  });
}


/**
 * @param {Object} client
 * @param {Object} context
 * @param {Object} pullrequest
 * @param {string} repositoryFullName
 * @param {string} projectUrl
 * @return {boolean}
 */
function onPullRequestCreated(client, context, pullrequest, repositoryFullName, projectUrl) {
  var jobInfo = {
    id: pullrequest.id,
    repositoryFullName: repositoryFullName,
    projectUrl: projectUrl,
    trigger: 'pullrequestJob'
  };

  api.resultHandler(client, context.emitter, jobInfo);

  return true;
}


/**
 * @param {Object} client
 * @param {Object} context
 * @param {Object} pullrequest
 * @param {string} repositoryFullName
 * @param {string} projectUrl
 * @return {boolean}
 */
function onPullRequestUpdated(client, context, pullrequest, repositoryFullName, projectUrl) {
  var hash = pullrequest.source.commit.hash;
  var lastCommitHashesLength = lastCommitHashes.length;

  lastCommitHashes = lastCommitHashes.filter(function (commitHash) {
    return commitHash !== hash;
  });

  if (lastCommitHashesLength !== lastCommitHashes.length) {
    return false;
  } else {
    lastCommitHashes.push(hash);
  }

  client.get(`${API2}repositories/${repositoryFullName}/pullrequests?state=OPEN`, function (req, res) {
    var id = res.values[0].id;
    var jobInfo = {
      id: id,
      repositoryFullName: repositoryFullName,
      projectUrl: projectUrl,
      trigger: 'pullrequestJob'
    };

    api.resultHandler(client, context.emitter, jobInfo);
  });

  return true;
}
