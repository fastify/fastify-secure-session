# fastify-secure-session

![CI](https://github.com/fastify/fastify-secure-session/workflows/CI/badge.svg)
[![NPM version](https://img.shields.io/npm/v/fastify-secure-session.svg?style=flat)](https://www.npmjs.com/package/fastify-secure-session)
[![Known Vulnerabilities](https://snyk.io/test/github/fastify/fastify-secure-session/badge.svg)](https://snyk.io/test/github/fastify/fastify-secure-session)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://standardjs.com/)

Create a secure stateless cookie session for Fastify, based on libsodium's
[Secret Key Box Encryption](https://github.com/sodium-friends/sodium-native#secret-key-box-encryption)
and [fastify-cookie](https://github.com/fastify/fastify-cookie).

## Using a pregenerated key

First generate a key with:

```sh
npx fastify-secure-session > secret-key
```

If running in Windows Powershell, you should use this command instead:

```sh
npx fastify-secure-session | Out-File -Encoding default -NoNewline -FilePath secret-key
```

Then, register the plugin as follows:

```js
'use strict'

const fastify = require('fastify')({ logger: false })
const fs = require('fs')
const path = require('path')

fastify.register(require('fastify-secure-session'), {
  // the name of the session cookie, defaults to 'session'
  cookieName: 'my-session-cookie',
  // adapt this to point to the directory where secret-key is located
  key: fs.readFileSync(path.join(__dirname, 'secret-key')),
  cookie: {
    path: '/'
    // options for setCookie, see https://github.com/fastify/fastify-cookie
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

If you enable [`debug` level logging](https://www.fastify.io/docs/latest/Logging/),
you will see what steps the library is doing and understand why a session you
expect to be there is not present. For extra details, you can also enable `trace`
level logging.

### Using keys as strings

You can convert your key file to a hexadecimal string. This is useful in scenarios where you would rather load the key from an environment variable instead of deploying a file.

To convert a key file into a hexadecimal string you can do this in an npm script:

```js
const keyBuffer = fs.readFileSync(path.join(__dirname, 'secret-key'));
const hexString = keyBuffer.toString('hex');
console.log(hexString) // Outputs: 4fe91796c30bd989d95b62dc46c7c3ba0b6aa2df2187400586a4121c54c53b85
```

To use your hexadecimal string with this plugin you would need convert it back into a Buffer:

```js
fastify.register(require('fastify-secure-session'), {
  key: Buffer.from(process.env.COOKIE_KEY, 'hex')
})
```

#### Security

- Although the example reads the key from a file on disk, it is poor practice when it comes to security. Ideally, you should store secret/keys into a key management service like Vault, KMS or something similar and read them at run-time.
- Use `httpOnly` session cookie for all production purposes to reduce the risk of session highjacking or XSS.

## Using a secret

It is possible to generate a high-entropy key from a (low-entropy)
secret passphrase. This approach is the simplest to use, but it adds
a significant startup delay as strong cryptography is applied.

```js
const fastify = require('fastify')({ logger: false })

fastify.register(require('fastify-secure-session'), {
  secret: 'averylogphrasebiggerthanthirtytwochars',
  salt: 'mq9hDxBVDbspDR6n',
  cookie: {
    path: '/',
    httpOnly: true // Use httpOnly for all production purposes
    // options for setCookie, see https://github.com/fastify/fastify-cookie
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

It is possible to use an array for the key field to support key rotation as an additional security measure.
Cookies will always be signed with the first key in the array to try to "err on the side of performance" however
if decoding the key fails, it will attempt to decode using every subsequent value in the key array.

IMPORTANT: The new key you are trying to rotate to should always be the first key in the array. For example:

```js
// first time running the app
fastify.register(require('fastify-secure-session'), {
  key: [mySecureKey]

  cookie: {
    path: '/'
    // options for setCookie, see https://github.com/fastify/fastify-cookie
  }
})
```

The above example will sign and encrypt/decrypt sessions just fine. However, what if you want an extra security measure of
being able to rotate your secret credentials for your application? This library supports this by allowing you to
do the following:

```js
// first time running the app
fastify.register(require('fastify-secure-session'), {
  key: [myNewKey, mySecureKey]

  cookie: {
    path: '/'
    // options for setCookie, see https://github.com/fastify/fastify-cookie
  }
})
```

See that `myNewKey` was added to the first index postion in the key array. This allows any sessions that were created
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

fastify.register(require('fastify-secure-session'), {
  // any old sessions signed with key2 will still be decoded successfully the first time and
  // then re-signed with key1 to keep good performance with subsequent calls
  key: [key1, key2],

  cookie: {
    path: '/'
    // options for setCookie, see https://github.com/fastify/fastify-cookie
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
This should allow ample support time for supporting sessions with an old key while rotating to the new one. If you have
really long lived sessions it could be possible to need to support 3 or even 4 keys. Since old sessions are re-signed
with the key at the first index the next time they are seen by the application, you can get away with this. That first
time the older session is decoded will be a little more expensive though.

For a full "start to finish" example without having to generate keys and setup a server file, see the _second_ test case in the test file at `/test/key-rotation.js` in this repo.

## Configuring cookie options inside a route

You can configure the options for `setCookie` inside a route by using the `session.options()` method.

```js
fastify.post('/', (request, reply) => {
  request.session.set('data', request.body)
  // .options takes any parameter that you can pass to setCookie
  request.session.options({ maxAge: 1000 * 60 * 60 })
  reply.send('hello world')
})
```

## Integrating with other libraries

If you need to encode or decode a session in related systems (like say `fastify-websockets`, which does not use normal Fastify `Request` objects), you can use `fastify-secure-session`'s decorators to encode and decode sessions yourself. This is less than ideal as this library's cookie setting code is battle tested by the community, but the option is there if you need it.

```js
fastify.createSecureSession({ foo: 'bar' })
// => Session returns a session object for manipulating with .get and .set to then be encoded with encodeSecureSession

fastify.encodeSecureSession(request.session)
// => "abcdefg" returns the signed and encrypted cookie string, suitable for passing to a Set-Cookie header

fastify.decodeSecureSession(request.cookies['session'])
// => Session | null  returns a session object which you can use to .get values from if decoding is successful, and null otherwise
```

## Add TypeScript types

The session data is typed as `{ [key: string]: any }`. This can be extended with [declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html) to get improved type support.

```ts
declare module 'fastify-secure-session' {
  interface SessionData {
    foo: string;
  }
}

fastify.get('/', (request, reply) => {
  request.session.get('foo'); // typed `string | undefined`
  reply.send('hello world')
})
```

## TODO

- [ ] add an option to just sign, and do not encrypt

## License

MIT
