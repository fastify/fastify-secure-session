'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

sodium.randombytes_buf(key)

test('supports a schema', async t => {
  const fastify = Fastify({ logger: false })

  fastify.register(require('../'), {
    key
  })

  const schema = {
    body: {
      type: 'object',
      properties: {
        foo: { type: 'string' }
      },
      required: ['foo']
    }
  }

  fastify.post('/', { schema }, (request, reply) => {
    request.session.set('data', request.body)
    reply.send('hello world')
  })

  t.after(() => fastify.close())

  const invalidResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      bar: 'baz'
    }
  })
  t.assert.ok(invalidResponse)
  t.assert.strictEqual(invalidResponse.statusCode, 400)
  t.assert.strictEqual(invalidResponse.headers['set-cookie'], undefined)

  const validResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      foo: 'bar'
    }
  })
  t.assert.ok(validResponse)
  t.assert.strictEqual(validResponse.payload, 'hello world')
  t.assert.ok(validResponse.headers['set-cookie'])
})
