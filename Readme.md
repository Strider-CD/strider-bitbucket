# Strider Bitbucket provider

This module provides seamless integration between strider and bitbucket,
including automatic addition/deletion of ssh-keys, and commit and pull-request
webhooks.

# Configuration

If you're running somewhere other than localhost:3000, you need to set the hostname config var. This can be done with an ENV variable thus:

```bash
PLUGIN_BITBUCKET_HOSTNAME="https://appxample.com" make serve
```

Note no training slash. If you want to use your own bitbucket consumer app, set `PLUGIN_BITBUCKET_APP_KEY` and `PLUGIN_BITBUCKET_APP_SECRET`.

Or if that's all too verbose, you can do `PLUGIN_BITBUCKET='{"hostname": "http://appxample.com", "appKey": "as34yih", "appSecret": "f4j83904"}'`. There's also a way to configure using a json file, but I'll explain that later.
