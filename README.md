strider-bitbucket
=================

This module provides seamless integration between strider and bitbucket,
including automatic addition/deletion of ssh-keys, and commit and pull-request
webhooks.

[![NPM](https://nodei.co/npm/strider-bitbucket.png)](https://nodei.co/npm/strider-bitbucket/)

# Features

- configuration
- clone, update, code caching
- commit webhooks management
- ssh key management
- skipping commits via `[skip ci]` in commit message
- pull-request webhook handling (Bitbucket Cloud)

# Configuration

If you're running somewhere other than localhost:3000, you need to set
the `SERVER_NAME` environment variable. This can be done like so:

```bash
SERVER_NAME="https://appxample.com" npm start
```

Note no training slash.

## Creating your own bitbucket app

Go to the API page at
https://bitbucket.org/account/user/[your-username]/api and click "Add
consumer".

Then set the env variables `PLUGIN_BITBUCKET_APP_KEY` and
`PLUGIN_BITBUCKET_APP_SECRET` to the values given you.
