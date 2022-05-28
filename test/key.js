'use strict'

const tap = require('tap')
const Fastify = require('fastify')
const fastifySecureSession = require('..')
const sodium = require('sodium-native')

tap.test('throws when key is not string array nor a Buffer array', async t => {
  t.plan(2)

  const fastify = Fastify({ logger: false })
  t.teardown(fastify.close.bind(fastify))

  await fastify.register(fastifySecureSession, {
    key: [true]
  }).after(err => {
    t.type(err, Error)
    t.equal(err.message, 'Key must be string or buffer')
  })
})

tap.test('throws when key is not string nor a Buffer', async t => {
  t.plan(2)

  const fastify = Fastify({ logger: false })
  t.teardown(fastify.close.bind(fastify))

  await fastify.register(fastifySecureSession, {
    key: true
  }).after(err => {
    t.type(err, Error)
    t.equal(err.message, 'key must be a string or a Buffer')
  })
})

tap.test('throws when key is not specified', async t => {
  t.plan(2)

  const fastify = Fastify({ logger: false })
  t.teardown(fastify.close.bind(fastify))

  await fastify.register(fastifySecureSession, {
    key: undefined
  }).after(err => {
    t.type(err, Error)
    t.equal(err.message, 'key or secret must specified')
  })
})

tap.test('support key length equals to "crypto_secretbox_KEYBYTES" length', t => {
  const fastify = Fastify({ logger: false })
  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

  sodium.randombytes_buf(key)

  fastify.register(fastifySecureSession, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data', request.body)
    reply.send('hello world')
  })

  t.teardown(fastify.close.bind(fastify))
  t.plan(6)

  fastify.get('/', (request, reply) => {
    const data = request.session.get('data')
    if (!data) {
      reply.code(404).send()
      return
    }
    reply.send(data)
  })

  fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      some: 'data'
    }
  }, (error, response) => {
    t.error(error)
    t.equal(response.statusCode, 200)
    t.ok(response.headers['set-cookie'])
    const { name } = response.cookies[0]
    t.equal(name, 'session')

    fastify.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: response.headers['set-cookie']
      }
    }, (error, response) => {
      t.error(error)
      t.same(JSON.parse(response.payload), { some: 'data' })
    })
  })
})

tap.test('does not support key length shorter than sodium "crypto_secretbox_KEYBYTES"', async t => {
  const fastify = Fastify({ logger: false })

  t.teardown(fastify.close.bind(fastify))
  t.plan(1)

  const arbitraryOffset = 5
  const keyWithNotEnoughLength = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES - arbitraryOffset)

  sodium.randombytes_buf(keyWithNotEnoughLength)

  fastify.register(fastifySecureSession, {
    key: keyWithNotEnoughLength
  })

  await t.rejects(() => fastify.after())
})

tap.test('does not support key length greater than sodium "crypto_secretbox_KEYBYTES"', async t => {
  const fastify = Fastify({ logger: false })

  t.teardown(fastify.close.bind(fastify))
  t.plan(1)

  const arbitraryOffset = 5
  const keyWithTooMuchLength = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES + arbitraryOffset)

  sodium.randombytes_buf(keyWithTooMuchLength)

  fastify.register(fastifySecureSession, {
    key: keyWithTooMuchLength
  })

  await t.rejects(() => fastify.after())
})
