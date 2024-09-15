'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

sodium.randombytes_buf(key)

test('sets a custom cookie name', async t => {
  const fastify = Fastify({ logger: false })
  t.after(() => fastify.close())

  fastify.register(require('../'), {
    cookieName: 'foobar',
    key
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
  const { name } = postResponse.cookies[0]
  t.assert.strictEqual(name, 'foobar')

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
