'use strict'

const Fastify = require('fastify')
const tap = require('tap')
const sodium = require('sodium-native')
const fastifySecureSession = require('..')

tap.test('support string key array', async t => {
  const fastify = Fastify({ logger: false })

  t.teardown(fastify.close.bind(fastify))
  t.plan(5)

  const key1 = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key1)

  const key2 = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key2)

  fastify.register(fastifySecureSession, {
    key: [key1.toString('base64'), key2.toString('base64')]
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

  const payload = { some: 'data' }

  const intialSetResponse = await fastify.inject({
    url: '/',
    method: 'POST',
    payload
  })

  t.equal(intialSetResponse.statusCode, 200)
  t.ok(intialSetResponse.headers['set-cookie'])

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: intialSetResponse.headers['set-cookie']
    }
  })

  t.same(JSON.parse(getResponse.payload), payload)

  const getResponseNewKey = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: intialSetResponse.headers['set-cookie']
    }
  })

  t.equal(getResponseNewKey.statusCode, 200)
  t.same(JSON.parse(getResponseNewKey.payload), payload)
})

tap.test('support key rotation with buffer key array', async t => {
  let fastify = Fastify({ logger: false })

  t.teardown(fastify.close.bind(fastify))
  t.plan(5)

  const key1 = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key1)

  const key2 = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key2)

  fastify.register(fastifySecureSession, {
    key: [key1, key2]
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

  const payload = { some: 'data' }

  const intialSetResponse = await fastify.inject({
    url: '/',
    method: 'POST',
    payload
  })

  t.equal(intialSetResponse.statusCode, 200)
  t.ok(intialSetResponse.headers['set-cookie'])

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: intialSetResponse.headers['set-cookie']
    }
  })

  t.same(JSON.parse(getResponse.payload), payload)

  // restart fastify to switch key order (rotation)
  await fastify.close()

  fastify = Fastify({ logger: false })

  fastify.register(fastifySecureSession, {
    key: [key2, key1]
  })

  fastify.get('/', (request, reply) => {
    const data = request.session.get('data')
    if (!data) {
      reply.code(404).send()
      return
    }
    reply.send(data)
  })

  const getResponseNewKey = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: intialSetResponse.headers['set-cookie']
    }
  })

  t.equal(getResponseNewKey.statusCode, 200)
  t.same(JSON.parse(getResponseNewKey.payload), payload)
})

tap.test('does not support an empty key array', async t => {
  const fastify = Fastify({ logger: false })

  t.teardown(fastify.close.bind(fastify))
  t.plan(1)

  fastify.register(fastifySecureSession, {
    key: []
  })

  await t.rejects(() => fastify.after())
})
