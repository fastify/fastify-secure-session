'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const cookie = require('cookie')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

sodium.randombytes_buf(key)

test('sets path on the cookie', async (t) => {
  const fastify = Fastify({ logger: false })
  fastify.register(require('../'), {
    key,
    cookie: {
      path: '/'
    }
  })

  t.after(() => fastify.close())

  fastify.post('/auth', (request, reply) => {
    request.session.set('data', request.body)
    reply.send('hello world')
  })

  const response = await fastify.inject({
    method: 'POST',
    url: '/auth',
    payload: {
      some: 'data'
    }
  })
  t.assert.ok(response)
  t.assert.strictEqual(response.statusCode, 200)
  t.assert.ok(response.headers['set-cookie'])
  t.assert.strictEqual(cookie.parse(response.headers['set-cookie']).Path, '/')
})
