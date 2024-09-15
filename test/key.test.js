'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const fastifySecureSession = require('..')
const sodium = require('sodium-native')

test('throws when key is not string array nor a Buffer array', async t => {
  const fastify = Fastify({ logger: false })
  t.after(() => fastify.close())
  fastify.register(fastifySecureSession, {
    key: [true]
  })

  t.assert.rejects(() => fastify.after(), /Key must be string or buffer/)
})

test('throws when key is not string nor a Buffer', async t => {
  const fastify = Fastify({ logger: false })
  t.after(() => fastify.close())
  fastify.register(fastifySecureSession, {
    key: true
  })
  t.assert.rejects(() => fastify.after(), /key must be a string or a Buffer/)
})

test('throws when key is not specified', async t => {
  const fastify = Fastify({ logger: false })
  t.after(() => fastify.close())

  fastify.register(fastifySecureSession, {
    key: undefined
  })

  t.assert.rejects(() => fastify.after(), /key or secret must specified/)
})

test('support key length equals to "crypto_secretbox_KEYBYTES" length', async t => {
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
  const { name } = postResponse.cookies[0]
  t.assert.strictEqual(name, 'session')

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

test('does not support key length shorter than sodium "crypto_secretbox_KEYBYTES"', async t => {
  const fastify = Fastify({ logger: false })

  t.after(() => fastify.close())

  const arbitraryOffset = 5
  const keyWithNotEnoughLength = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES - arbitraryOffset)

  sodium.randombytes_buf(keyWithNotEnoughLength)

  fastify.register(fastifySecureSession, {
    key: keyWithNotEnoughLength
  })

  await t.assert.rejects(() => fastify.after(), /key must be 32 bytes/)
})

test('does not support key length greater than sodium "crypto_secretbox_KEYBYTES"', async t => {
  const fastify = Fastify({ logger: false })

  t.after(() => fastify.close())

  const arbitraryOffset = 5
  const keyWithTooMuchLength = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES + arbitraryOffset)

  sodium.randombytes_buf(keyWithTooMuchLength)

  fastify.register(fastifySecureSession, {
    key: keyWithTooMuchLength
  })

  await t.assert.rejects(() => fastify.after(), /key must be 32 bytes/)
})

test('signing works with only a key', async (t) => {
  const fastify = Fastify({ logger: false })
  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

  sodium.randombytes_buf(key)

  fastify.register(fastifySecureSession, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data', request.body)
    reply.setCookie('my-session', JSON.stringify(request.body), {
      httpOnly: true,
      secure: true,
      maxAge: 3600,
      signed: true,
      path: '/'
    })
    reply.send('session set')
  })

  fastify.get('/secure-session', (request, reply) => {
    const data = request.session.get('data')
    if (!data) {
      reply.code(404).send()
      return
    }
    reply.send(data)
  })

  fastify.get('/cookie-signed', (request, reply) => {
    const data = request.unsignCookie(request.cookies['my-session'])
    if (!data.valid) {
      reply.code(404).send()
      return
    }
    reply.send(data.value)
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

  const cookieHeader = postResponse.headers['set-cookie'].join(';')

  const sessionResponse = await fastify.inject({
    method: 'GET',
    url: '/secure-session',
    headers: {
      cookie: cookieHeader
    }
  })
  t.assert.ok(sessionResponse)
  t.assert.deepStrictEqual(JSON.parse(sessionResponse.payload), { some: 'data' })

  const cookieResponse = await fastify.inject({
    method: 'GET',
    url: '/cookie-signed',
    headers: {
      cookie: cookieHeader
    }
  })
  t.assert.ok(cookieResponse)
  t.assert.deepStrictEqual(JSON.parse(cookieResponse.payload), { some: 'data' })
})
