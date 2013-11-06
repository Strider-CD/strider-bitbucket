
var superagent = require('superagent')
  , gravatar = require('gravatar')
  , crypto = require('crypto')
  , async = require('async')
  , debug = require('debug')('strider-bitbucket:api')

var API = 'https://bitbucket.org/api/1.0/'

module.exports = {
  parseRepo: parseRepo,
  postPayload: postPayload,
  generateSecret: generateSecret,
  setWebhooks: setWebhooks,
  removeWebhooks: removeWebhooks,
  startCommitJob: startCommitJob,
  makeJob: makeJob
}

function generateSecret(callback) {
  crypto.randomBytes(32, function (err, buf) {
    callback(err, buf && buf.toString('hex'))
  })
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

function removeWebhooks(client, hostname, project_name, done) {
  var url = API + 'repositories/' + project_name + '/services'
    , hitbase = hostname + '/' + project_name + '/api/bitbucket/'
    , tasks = []
  function remove(id, next) {
    debug('removing', id)
    client.del(url + '/' + id + '/', function (err, data) {
      debug('removed response', id, err, data)
      next(err)
    })
  }
  debug('checking for services', url)
  client.get(url, function (err, data) {
    debug('response', err, JSON.stringify(data))
    if (err) return done(err)
    var fields, hit
    for (var i=0; i<data.length; i++) {
      if (data[i].service.type.indexOf('POST') === -1) continue;
      fields = data[i].service.fields
      hit = false
      for (var j=0; j<fields.length; j++) {
        if (fields[j].name === 'URL' &&
            fields[j].value.toLowerCase().indexOf(hitbase) === 0) {
          debug('found a match!', data[i], fields[j])
          hit = true
          break;
        }
      }
      if (hit) {
        tasks.push(remove.bind(null, data[i].id))
      }
    }
    debug(tasks.length, 'matches found')
    if (!tasks.length) return done(null)
    async.parallel(tasks, function (err) {
      done(err, true)
    })
  })
}

function setWebhooks(client, hostname, project_name, done) {
  var url = API + 'repositories/' + project_name + '/services'
    , hitbase = hostname + '/' + project_name + '/api/bitbucket/'
  debug('checking for existing services', url)
  client.get(url, function (err, data, res) {
    debug('response', err, data, res.status)
    if (err) return done(err)
    var fields, hit
    for (var i=0; i<data.length; i++) {
      if (data[i].service.type.indexOf('POST') === -1) continue;
      fields = data[i].service.fields
      hit = false
      // TODO check for the POST and PR hooks separately, and if their
      // 'secret's differ, then reset one to match the other
      for (var j=0; j<fields.length; j++) {
        if (fields[j].name === 'URL' &&
            fields[j].value.toLowerCase().indexOf(hitbase) === 0) {
          hit = fields[j].value
          break;
        }
      }
      if (hit) {
        debug('Found a matching service already there...', hit, data[i])
        return done(null, hit.slice(hitbase.length), true)
      }
    }
    generateSecret(function (err, secret) {
      debug('generated secret', err, secret)
      if (err) return done(err)
      debug('create POST service', url, hitbase, hitbase + 'commit/' + secret)
      client.post(url + '/', {
        type: 'POST',
        URL: hitbase + 'commit/' + secret
      }, function (err, data, req) {
        debug('response:', err, data, req.status)
        if (err) return done(err)
        debug('create Pull Request POST service', url, hitbase, hitbase + 'pull-request/' + secret)
        client.post(url + '/', {
          type: 'Pull Request POST',
          'create/edit/merge/decline': 'on',
          comments: 'on',
          'approve/unapprove': 'on',
          URL: hitbase + 'pull-request/' + secret
        }, function (err, data, req) {
          debug('response:', err, data, req.status)
          return done(null, secret)
        })
      })
    })
  })
}

function parseAuthor(raw) {
  var match = raw.match(/([^<]+)<([^>]+)>/)
  if (!match) {
    return {
      name: raw.trim(),
      email: null
    }
  }
  return {
    name: match[1].trim(),
    email: match[2].trim()
  }
}

function postPayload(payload) {
  var commit = payload.commits[payload.commits.length - 1]
    , author = parseAuthor(commit.raw_author)
  return {
    trigger: {
      type: 'commit',
      author: {
        name: author.name,
        email: author.email,
        image: author.email && gravatar.url(author.email, {}, true)
      },
      url: payload.canon_url + payload.repository.absolute_url + 'commits/' + commit.raw_node,
      message: commit.message,
      timestamp: commit.timestamp,
      source: {
        type: 'plugin',
        plugin: 'bitbucket'
      }
    },
    deploy: true,
    branch: commit.branch,
    ref: {
      branch: commit.branch,
      id: commit.raw_node
    }
  }
}

function startCommitJob(payload, project, emitter, done) {
  debug('starting commit job', payload, project.name)
  var data = postPayload(payload)
    , branch = project.branch(data.branch)
    , job
  if (branch) {
    job = makeJob(project, data)
    if (!job) {
      console.log('webhook received, but branch is not active')
      return done(null)
    }
    emitter.emit('job.prepare', job)
    return done()
  }
  project.addBranch(data.branch, function (err) {
    if (err) return done(new Error('failed to add branch: ' + err.message))
    job = makeJob(project, data)
    if (!job) {
      console.log('webhook received, but branch is not active')
      return done(null)
    }
    emitter.emit('job.prepare', job)
    done()
  })
}

// TODO: this should be in a strider-lib module or something. It's
// needed by a lot of plugins (just copied from strider-github)
function makeJob(project, config) {
  var now = new Date()
    , deploy = false
    , commit
    , trigger
    , branch
    , ref
    , job
  branch = project.branch(config.branch) || {active: true, mirror_master: true, deploy_on_green: false}
  if (!branch.active) return false
  if (config.branch !== 'master' && branch.mirror_master) {
    // mirror_master branches don't deploy
    deploy = false
  } else {
    deploy = config.deploy && branch.deploy_on_green
  }
  job = {
    type: deploy ? 'TEST_AND_DEPLOY' : 'TEST_ONLY',
    trigger: config.trigger,
    project: project.name,
    ref: config.ref,
    user_id: project.creator._id,
    created: now
  }
  return job
}
