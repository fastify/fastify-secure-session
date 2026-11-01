'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const SecureSessionPlugin = require('../')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

test('supports serializing bigint values in session data', async t => {
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('id', 9007199254740993n)
    request.session.nested = {
      amount: 12345678901234567890n
    }

    reply.send('ok')
  })

  t.after(() => fastify.close())

  fastify.get('/', (request, reply) => {
    reply.send(request.session.data())
  })

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/'
  })
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })

  t.assert.strictEqual(getResponse.statusCode, 200)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), {
    id: '9007199254740993',
    nested: {
      amount: '12345678901234567890'
    }
  })
})
