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
