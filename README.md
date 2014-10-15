strider-bitbucket
=================

This module provides seamless integration between strider and bitbucket,
including automatic addition/deletion of ssh-keys, and commit and pull-request
webhooks.

[![NPM](https://nodei.co/npm/strider-bitbucket.png)](https://nodei.co/npm/strider-bitbucket/)

## What's done

- configuration
- clone, update, code caching
- commit webhooks management
- ssh key management

## What's not done

- pull-request webhook handling (they are created, we just don't do anything with them atm)

# Configuration

If you're running somewhere other than localhost:3000, you need to set
the hostname config var. This can be done with an ENV variable thus:

```bash
PLUGIN_BITBUCKET_HOSTNAME="https://appxample.com" make serve
```

Note no training slash.

## Creating your own bitbucket app

Go to the api page at
https://bitbucket.org/account/user/[your-username]/api and click "Add
consumer".

Then set the env variables `PLUGIN_BITBUCKET_APP_KEY` and
`PLUGIN_BITBUCKET_APP_SECRET` to the values given you.

Or if that's all too verbose, you can do
`PLUGIN_BITBUCKET='{"hostname": "http://appxample.com", "appKey": "as34yih", "appSecret": "f4j83904"}'`.
There's also a way to configure using a json file, but I'll explain that later.
