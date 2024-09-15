'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const SecureSessionPlugin = require('../')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

test('Custom options', async t => {
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data', request.body)
    request.session.options({ maxAge: 1000 * 60 * 60 })
    reply.send('hello world')
  })

  t.after(() => fastify.close())

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

  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])
  const { maxAge } = postResponse.cookies[0]
  t.assert.strictEqual(maxAge, 1000 * 60 * 60)

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })

  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), { some: 'data' })
})

test('Override global options', async t => {
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key,
    cookieOptions: {
      maxAge: 42,
      path: '/'
    }
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data', request.body)
    request.session.options({ maxAge: 1000 * 60 * 60 })
    reply.send('hello world')
  })

  t.after(() => fastify.close())

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
  const { maxAge, path } = postResponse.cookies[0]
  t.assert.strictEqual(maxAge, 1000 * 60 * 60)
  t.assert.strictEqual(path, '/')

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
