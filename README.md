# fastify-secure-session

Create a secure stateless cookie session for Fastify, based on libsodium's
[Secret Key Box Encryption](https://github.com/sodium-friends/sodium-native#secret-key-box-encryption)
and [fastify-cookie](https://github.com/fastify/fastify-cookie).

## Using a pregenerated key

First generate a key with:

```
./node_modules/.bin/secure-session-gen-key > secret-key
```

Then, register the plugin as follows:

```js
'use strict'

const fastify = require('fastify')({ logger: false })
const fs = require('fs')
const path = require('path')

fastify.register(require('./'), {
  // adapt this to point to the directory where secret-key is located
  key: fs.readFileSync(path.join(__dirname, 'secret-key')),
  cookie: {
    // options from setCookie, see https://github.com/fastify/fastify-cookie
  }
})

fastify.post('/', (request, reply) => {
  request.session.set('data', request.body)
  reply.send('hello world')
})

fastify.get('/', (request, reply) => {
  const data = request.session.get('data')
  if (!data) {
    reply.code(404).send()
    return
  }
  reply.send(data)
})

fastify.post('/logout', (request, reply) => {
  request.session.delete()
  reply.send('logged out')
})
```

## Using a secret

It's possible to generate a high-entropy key from a (low-entropy)
secret passphrase. This approach is the simplest to use, but it adds
a significant startup delay as strong cryptography is applied.

```js
const fastify = require('fastify')({ logger: false })

fastify.register(require('./'), {
  secret: 'averylogphrasebiggerthanthirtytwochars',
  salt: 'mq9hDxBVDbspDR6n',
  cookie: {
    // options from setCookie, see https://github.com/fastify/fastify-cookie
  }
})

fastify.post('/', (request, reply) => {
  request.session.set('data', request.body)
  reply.send('session set')
})

fastify.get('/', (request, reply) => {
  const data = request.session.get('data')
  if (!data) {
    reply.code(404).send()
    return
  }
  reply.send(data)
})

fastify.listen(3000)
```

## TODO

* [ ] add an option to just sign, and do not encrypt

## License

MIT
