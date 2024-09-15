'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
const salt = Buffer.alloc(sodium.crypto_pwhash_SALTBYTES)

sodium.randombytes_buf(key)
sodium.randombytes_buf(salt)

test('supports a salt', async (t) => {
  const fastify = Fastify({ logger: false })

  fastify.register(require('../'), {
    key,
    salt
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

  t.after(() => fastify.close())

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      some: 'data'
    }
  })
  t.assert.ok(postResponse)
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })
  t.assert.ok(getResponse)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), { some: 'data' })
})
