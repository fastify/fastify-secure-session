'use strict'

const { test } = require('node:test')
const fastify = require('fastify')({ logger: false })
const sodium = require('sodium-native')

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
