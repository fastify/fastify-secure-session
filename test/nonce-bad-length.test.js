'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

sodium.randombytes_buf(key)

test('handles invalid length cookie', async (t) => {
  const fastify = Fastify({ logger: false })

  fastify.register(require('../'), {
    key
  })

  fastify.get('/get', (request, reply) => {
    const data = request.session.get('data')
    reply.send(data)
  })

  fastify.get('/set', (request, reply) => {
    request.session.set('data', { hello: 'world' })
    reply.send('hello world')
  })

  t.after(() => fastify.close())

  const setResponse = await fastify.inject({
    method: 'GET',
    url: '/set'
  })
  t.assert.ok(setResponse)
  t.assert.strictEqual(setResponse.statusCode, 200)
  const cookie = setResponse.cookies[0]

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/get',
    cookies: {
      [cookie.name]: cookie.value + 'a'.repeat(10)
    }
  })
  t.assert.ok(getResponse)
  t.assert.strictEqual(getResponse.statusCode, 200)
  // the session is empty, so we expect an empty string
  t.assert.strictEqual(getResponse.payload, '')
})
