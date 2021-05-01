const { test } = require('tap')
const sodium = require('sodium-native')

test('decodeSecureSession should return null when the cipher stored in cookie is not long enough', t => {
  t.plan(2)

  const app = require('fastify')({ logger: false })

  app
    .register(
      require('..'),
      { key: Buffer.allocUnsafe(sodium.crypto_secretbox_KEYBYTES) }
    )

  app.get('/', async function (req, rep) {
    let calledDebug = false
    const log = { debug () { calledDebug = true } }

    const decodeResult = this.decodeSecureSession(req.cookies.session, log)

    t.equal(calledDebug, true)
    t.equal(decodeResult, null)
  })

  app.inject({
    url: '/',
    method: 'GET',
    cookies: {
      session: createMalformedCookie()
    }
  })

  // ***************
  function createMalformedCookie () {
    const cyphertextB64 = Buffer.allocUnsafe(sodium.crypto_secretbox_MACBYTES - 1).toString('base64')
    const nonce = Buffer.allocUnsafe(sodium.crypto_secretbox_NONCEBYTES).toString('base64')

    return `${cyphertextB64};${nonce}`
  }
})

test('decodeSecureSession should return null if cipher cannot be decrypted', async (t) => {
  t.plan(2)

  // Creating the keys
  const firstKey = Buffer.allocUnsafe(sodium.crypto_secretbox_KEYBYTES)
  const secondKey = Buffer.allocUnsafe(sodium.crypto_secretbox_KEYBYTES)

  sodium.randombytes_buf(firstKey)
  sodium.randombytes_buf(secondKey)

  // Creating the initial instance to get a cookie
  // signed by the first key
  let app = createApp(firstKey)

  const encryptedCookie = (await app.inject({ method: 'GET', url: '/' })).cookies[0].value

  // Closing and recreating the app instance
  await app.close()
  app = createApp(secondKey)

  // Running the assertions
  await app.inject({
    url: '/assert',
    method: 'GET',
    cookies: {
      session: encryptedCookie
    }
  })

  // ********************
  function createApp (key) {
    const Fastify = require('fastify')
    const secureSession = require('..')
    const app = Fastify({ logger: false })

    app.register(secureSession, { key })

    // Setting the session cookie
    app.get('/', async function (req) {
      req.session.set('greeting', { hello: 'world' })
      return 'set!'
    })

    // Route that runs all of the test's assertions
    app.get('/assert', async function (req) {
      let logged = false
      const decodedSession = this.decodeSecureSession(req.cookies.session, {
        debug () { logged = true }
      })

      t.equal(decodedSession, null)
      t.equal(logged, true)

      return 'verified!'
    })

    return app
  }
})
