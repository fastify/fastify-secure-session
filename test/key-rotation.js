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

tap.test('signing works with only a string key array', function (t) {
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

  t.teardown(fastify.close.bind(fastify))
  t.plan(7)

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

    const cookieHeader = response.headers['set-cookie'].join(';')

    fastify.inject({
      method: 'GET',
      url: '/secure-session',
      headers: {
        cookie: cookieHeader
      }
    }, (error, response) => {
      t.error(error)
      t.same(JSON.parse(response.payload), { some: 'data' })

      fastify.inject({
        method: 'GET',
        url: '/cookie-signed',
        headers: {
          cookie: cookieHeader
        }
      }, (error, response) => {
        t.error(error)
        t.same(JSON.parse(response.payload), { some: 'data' })
      })
    })
  })
})

tap.test('signing works with only a buffer key array', function (t) {
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

  t.teardown(fastify.close.bind(fastify))
  t.plan(7)

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

    const cookieHeader = response.headers['set-cookie'].join(';')

    fastify.inject({
      method: 'GET',
      url: '/secure-session',
      headers: {
        cookie: cookieHeader
      }
    }, (error, response) => {
      t.error(error)
      t.same(JSON.parse(response.payload), { some: 'data' })

      fastify.inject({
        method: 'GET',
        url: '/cookie-signed',
        headers: {
          cookie: cookieHeader
        }
      }, (error, response) => {
        t.error(error)
        t.same(JSON.parse(response.payload), { some: 'data' })
      })
    })
  })
})
