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

## Using Keys with key rotation

It's possible to use an array for the key field to support key rotation as an additional security measure.
Cookies will always be signed with the first key in the array to try to "err on the side of performance" however
if decoding the key fails, it will attempt to decode using every subsequent value in the key array.

WARNING: This operation can get expensive if too many keys are used. It is recommended to only use 2 keys at anytime.
This should allow ample support time for supporting sessions with an old key while rotating to the new one.

IMPORTANT: The new key you are trying to rotate to should always be the first key in the array.

```js
const fastify = require('fastify')({ logger: false })

const key1 = fs.readFileSync(path.join(__dirname, 'secret-key1'));
const key2 = fs.readFileSync(path.join(__dirname, 'secret-key2'));

fastify.register(require('./'), {
  key: [key1, key2],

  cookie: {
    // options from setCookie, see https://github.com/fastify/fastify-cookie
  }
})

fastify.post('/', (request, reply) => {
  // will always be encrypted using `key1` with the configuration above
  request.session.set('data', request.body)
  reply.send('session set')
})

fastify.get('/', (request, reply) => {
  // will attempt to decode using key1 and then key2 if decoding with key1 fails
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
