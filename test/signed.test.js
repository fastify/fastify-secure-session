'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const cookiePlugin = require('@fastify/cookie')
const sodium = require('sodium-native')
const fastifySecureSession = require('..')

// Deferred instance used by the first test below
const fastify = Fastify({ logger: false })

test('signed session cookie should works if not tampered with', async (t) => {
  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key)

  fastify.register(require('../'), {
    key,
    cookieName: '__Host-session',
    cookie: {
      secure: true,
      httpOnly: true,
      path: '/',
      signed: true
    }
  })

  fastify.post('/', (request, reply) => {
    request.session.set('userId', '123')
    reply.send('done')
  })

  fastify.get('/', (request, reply) => {
    const data = request.session.get('userId')
    if (!data) {
      reply.code(404).send()
      return
    }
    reply.send(data)
  })

  t.after(() => fastify.close())

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {}
  })

  t.assert.ok(postResponse)
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])

  const { name } = postResponse.cookies[0]
  t.assert.strictEqual(name, '__Host-session')

  const originalCookie = postResponse.headers['set-cookie']

  const validGetResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: originalCookie
    }
  })
  t.assert.ok(validGetResponse)
  t.assert.deepStrictEqual(validGetResponse.payload, '123')

  const cookieContent = originalCookie.split(';')[0]

  // Change the last 5 characters to AAAAA, to tamper with the cookie
  const cookieContentTampered = cookieContent.slice(0, -5) + 'AAAAA'

  const tamperedCookie = originalCookie.replace(cookieContent, cookieContentTampered)

  const tamperedGetResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: tamperedCookie
    }
  })
  t.assert.ok(tamperedGetResponse)
  t.assert.strictEqual(tamperedGetResponse.statusCode, 404, 'Should fail with tampered cookie')
})

test('a stripped cookie must not bypass the signing key check after rotation', async (t) => {
  // Reproduces GHSA-4CGQ-X5F7-R8JV: with an independent @fastify/cookie
  // signing secret, rotating only that secret must retire old session
  // cookies. Stripping the stale signature must not restore access while the
  // encryption key is left unchanged.
  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key)

  function app (signer, encryptionKey = key) {
    const server = Fastify({ logger: false })
    server.register(cookiePlugin, { secret: signer })
    server.register(fastifySecureSession, {
      key: encryptionKey,
      expiry: 600,
      cookie: { signed: true }
    })
    server.post('/issue', (request) => {
      request.session.set('user', 'synthetic')
      return { issued: true }
    })
    server.get('/read', (request) => ({
      user: request.session.get('user') || null
    }))
    return server
  }

  const oldApp = app('old-independent-signing-key-123456789')
  const newApp = app('new-independent-signing-key-123456789')
  const removedKeyApp = app('new-independent-signing-key-123456789', Buffer.alloc(sodium.crypto_secretbox_KEYBYTES))

  t.after(async () => {
    await Promise.allSettled([oldApp.close(), newApp.close(), removedKeyApp.close()])
  })

  async function issue (server) {
    const response = await server.inject({ method: 'POST', url: '/issue' })
    t.assert.strictEqual(response.statusCode, 200)
    return response.headers['set-cookie'].split(';')[0]
  }

  async function read (server, cookie) {
    const response = await server.inject({
      method: 'GET', url: '/read', headers: { cookie }
    })
    t.assert.strictEqual(response.statusCode, 200)
    return response.json().user
  }

  const oldCookie = await issue(oldApp)
  const equal = oldCookie.indexOf('=')
  const name = oldCookie.slice(0, equal)
  const signed = decodeURIComponent(oldCookie.slice(equal + 1))
  const dot = signed.lastIndexOf('.')
  t.assert.ok(dot > 0)

  const unsigned = signed.slice(0, dot)
  const stripped = name + '=' + encodeURIComponent(unsigned)

  await newApp.ready()
  t.assert.strictEqual(newApp.unsignCookie(signed).valid, false)
  t.assert.strictEqual(newApp.unsignCookie(unsigned).valid, false)

  const result = {
    oldSignedOnOldSigner: await read(oldApp, oldCookie),
    oldSignedOnNewSigner: await read(newApp, oldCookie),
    strippedOnNewSigner: await read(newApp, stripped),
    freshSignedOnNewSigner: await read(newApp, await issue(newApp)),
    removedEncryptionKey: await read(removedKeyApp, stripped)
  }

  t.assert.deepStrictEqual(result, {
    oldSignedOnOldSigner: 'synthetic',
    oldSignedOnNewSigner: null,
    // The core regression: the stripped signature must NOT decrypted again.
    strippedOnNewSigner: null,
    freshSignedOnNewSigner: 'synthetic',
    removedEncryptionKey: null
  })
})
