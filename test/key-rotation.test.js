'use strict'

const Fastify = require('fastify')
const { test } = require('node:test')
const sodium = require('sodium-native')
const fastifySecureSession = require('..')

test('support string key array', async t => {
  const fastify = Fastify({ logger: false })

  t.after(() => fastify.close())

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

  t.assert.strictEqual(intialSetResponse.statusCode, 200)
  t.assert.ok(intialSetResponse.headers['set-cookie'])

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: intialSetResponse.headers['set-cookie']
    }
  })

  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), payload)

  const getResponseNewKey = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: intialSetResponse.headers['set-cookie']
    }
  })

  t.assert.strictEqual(getResponseNewKey.statusCode, 200)
  t.assert.deepStrictEqual(JSON.parse(getResponseNewKey.payload), payload)
})

test('support key rotation with buffer key array', async t => {
  let fastify = Fastify({ logger: false })

  t.after(() => fastify.close())

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

  t.assert.strictEqual(intialSetResponse.statusCode, 200)
  t.assert.ok(intialSetResponse.headers['set-cookie'])

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: intialSetResponse.headers['set-cookie']
    }
  })

  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), payload)

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

  t.assert.strictEqual(getResponseNewKey.statusCode, 200)
  t.assert.deepStrictEqual(JSON.parse(getResponseNewKey.payload), payload)
})

test('does not support an empty key array', async t => {
  const fastify = Fastify({ logger: false })

  t.after(() => fastify.close())

  fastify.register(fastifySecureSession, {
    key: []
  })

  await t.assert.rejects(() => fastify.after())
})

test('signing works with only a string key array', async (t) => {
  const fastify = Fastify({ logger: false })

  const key1 = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key1)

  const key2 = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key2)

  fastify.register(fastifySecureSession, {
    key: [key1.toString('base64'), key2.toString('base64')]
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

test('signing works with only a buffer key array', async (t) => {
  const fastify = Fastify({ logger: false })

  const key1 = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key1)

  const key2 = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key2)

  fastify.register(fastifySecureSession, {
    key: [key1, key2]
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
