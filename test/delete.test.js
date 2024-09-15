'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const cookie = require('cookie')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
const expires = new Date(Date.now() + (86400 * 1000))
const expiresUTC = expires.toUTCString()

sodium.randombytes_buf(key)

test('Deletes the cookie', async (t) => {
  const fastify = Fastify({ logger: false })

  fastify.register(require('../'), {
    key,
    cookie: {
      path: '/',
      expires,
      maxAge: 86400
    }
  })

  fastify.post('/', (request, reply) => {
    request.session.set('some', request.body.some)
    request.session.set('some2', request.body.some2)
    reply.send('hello world')
  })

  fastify.post('/delete', (request, reply) => {
    request.session.delete()
    reply.send('hello world')
  })

  t.after(() => fastify.close())

  fastify.get('/', (request, reply) => {
    const some = request.session.get('some')
    const some2 = request.session.get('some2')
    if (!some || !some2) {
      reply.code(404).send()
      return
    }
    reply.send({ some, some2 })
  })

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      some: 'someData',
      some2: { a: 1, b: undefined, c: 3 }
    }
  })
  t.assert.ok(postResponse)
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])
  t.assert.strictEqual(cookie.parse(postResponse.headers['set-cookie']).Path, '/')
  t.assert.strictEqual(cookie.parse(postResponse.headers['set-cookie']).Expires, expiresUTC)
  t.assert.strictEqual(cookie.parse(postResponse.headers['set-cookie'])['Max-Age'], '86400')

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })
  t.assert.ok(getResponse)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), { some: 'someData', some2: { a: 1, c: 3 } })

  const deleteResponse = await fastify.inject({
    method: 'POST',
    url: '/delete',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })
  t.assert.ok(deleteResponse)
  t.assert.strictEqual(deleteResponse.statusCode, 200)
  t.assert.ok(deleteResponse.headers['set-cookie'])
  t.assert.strictEqual(cookie.parse(deleteResponse.headers['set-cookie']).Path, '/')
  t.assert.strictEqual(cookie.parse(deleteResponse.headers['set-cookie']).Expires, 'Thu, 01 Jan 1970 00:00:00 GMT')
  t.assert.strictEqual(cookie.parse(deleteResponse.headers['set-cookie'])['Max-Age'], '0')
})
