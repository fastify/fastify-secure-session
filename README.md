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

IMPORTANT: The new key you are trying to rotate to should always be the first key in the array.  For example:

```js
// first time running the app
fastify.register(require('./'), {
  key: [mySecureKey]

  cookie: {
    // options from setCookie, see https://github.com/fastify/fastify-cookie
  }
})
```
The above example will sign and encrypt/decrypt sessions just fine.  But what if you want an extra security measure of
being able to rotate your secret credentials for your application?  This library supports this by allowing you to
do the following:
```js
// first time running the app
fastify.register(require('./'), {
  key: [myNewKey, mySecureKey]

  cookie: {
    // options from setCookie, see https://github.com/fastify/fastify-cookie
  }
})
```
See that `myNewKey` was added to the first index postion in the key array.  This allows any sessions that were created
with the original `mySecureKey` to still be decoded. The first time a session signed with an older key is "seen", by the application, this library will re-sign the cookie with the newest session key therefore improving performance for any subsequent session decodes.

To see a full working example, make sure you generate `secret-key1` and `secret-key2` alongside the js file below by running:
```
./node_modules/.bin/secure-session-gen-key > secret-key1
./node_modules/.bin/secure-session-gen-key > secret-key2
```

```js
const fs = require('fs')
const fastify = require('fastify')({ logger: false })

const key1 = fs.readFileSync(path.join(__dirname, 'secret-key1'))
const key2 = fs.readFileSync(path.join(__dirname, 'secret-key2'))

fastify.register(require('./'), {
  // any old sessions signed with key2 will still be decoded successfully the first time and
  // then re-signed with key1 to keep good performance with subsequent calls
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

WARNING: The more keys you have in the key array can make the decode operation get expensive if too many keys are used.
at once. It is recommended to only use 2 keys at a given time so that the most decode attempts will ever be is 2.
This should allow ample support time for supporting sessions with an old key while rotating to the new one.  If you have
really long lived sessions it could be possible to need to support 3 or even 4 keys.  Since old sessions are re-signed
with the key at the first index the next time they are seen by the application, you can get away with this.  That first
time the older session is decoded will be a little more expensive though.

For a full "start to finish" example without having to generate keys and setup a server file, see the *second* test case in the test file at `/test/key-rotation.js` in this repo.

## TODO

* [ ] add an option to just sign, and do not encrypt

## License

MIT
