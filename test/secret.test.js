'use strict'

const sodium = require('sodium-native')
const { test } = require('node:test')

test('throws when secret is less than 32 bytes', async function (t) {
  t.plan(1)

  const fastify = require('fastify')({
    logger: false
  })
  t.after(() => fastify.close())

  await fastify.register(require('../'), {
    secret: 'a'.repeat(31)
  }).after((err) => {
    t.assert.strictEqual(err.message, 'secret must be at least 32 bytes')
  })
})

test('not throws when secret is greater than or equal to 32 bytes', async function (t) {
  t.plan(1)

  const fastify = require('fastify')({
    logger: false
  })
  t.after(() => fastify.close())

  await fastify.register(require('../'), {
    secret: 'a'.repeat(32)
  }).after((err) => {
    t.assert.ifError(err)
  })
})

test('throws when salt is less than sodium.crypto_pwhash_SALTBYTES', async function (t) {
  t.plan(1)

  const fastify = require('fastify')({
    logger: false
  })
  t.after(() => fastify.close())

  await fastify.register(require('../'), {
    secret: 'a'.repeat(32),
    salt: 'a'.repeat(sodium.crypto_pwhash_SALTBYTES - 1)
  }).after((err) => {
    t.assert.strictEqual(err.message, `salt must be length ${sodium.crypto_pwhash_SALTBYTES}`)
  })
})

test('not throws when salt is greater than or equal to sodium.crypto_pwhash_SALTBYTES', async function (t) {
  t.plan(1)

  const fastify = require('fastify')({
    logger: false
  })
  t.after(() => fastify.close())

  await fastify.register(require('../'), {
    secret: 'a'.repeat(32),
    salt: 'a'.repeat(sodium.crypto_pwhash_SALTBYTES)
  }).after((err) => {
    t.assert.ifError(err)
  })
})

test('using secret without salt', async (t) => {
  const fastify = require('fastify')({
    logger: false
  })

  fastify.register(require('../'), {
    secret: 'averylogphrasebiggerthanthirtytwochars'
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

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })
  t.assert.ok(postResponse)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), {
    some: 'data'
  })
})

test('using secret with salt as string', async (t) => {
  const fastify = require('fastify')({
    logger: false
  })

  fastify.register(require('../'), {
    secret: 'averylogphrasebiggerthanthirtytwochars',
    salt: 'mq9hDxBVDbspDR6n'
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
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), {
    some: 'data'
  })
})

test('using secret with salt as buffer', async (t) => {
  const fastify = require('fastify')({
    logger: false
  })

  fastify.register(require('../'), {
    secret: 'averylogphrasebiggerthanthirtytwochars',
    salt: Buffer.from('mq9hDxBVDbspDR6n', 'ascii')
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
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), {
    some: 'data'
  })
})

test('signing works with a secret', async (t) => {
  const fastify = require('fastify')({
    logger: false
  })

  fastify.register(require('../'), {
    secret: 'averylogphrasebiggerthanthirtytwochars',
    salt: 'mq9hDxBVDbspDR6n'
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
