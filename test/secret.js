'use strict'

const sodium = require('sodium-native')
const tap = require('tap')

tap.test('throws when secret is less than 32 bytes', async function (t) {
  t.plan(2)

  const fastify = require('fastify')({
    logger: false
  })
  t.teardown(fastify.close.bind(fastify))

  await fastify.register(require('../'), {
    secret: 'a'.repeat(31)
  }).after((err) => {
    t.type(err, Error)
    t.equal(err.message, 'secret must be at least 32 bytes')
  })
})

tap.test('not throws when secret is greater than or equal to 32 bytes', async function (t) {
  t.plan(1)

  const fastify = require('fastify')({
    logger: false
  })
  t.teardown(fastify.close.bind(fastify))

  await fastify.register(require('../'), {
    secret: 'a'.repeat(32)
  }).after((err) => {
    t.error(err)
  })
})

tap.test('throws when salt is less than sodium.crypto_pwhash_SALTBYTES', async function (t) {
  t.plan(2)

  const fastify = require('fastify')({
    logger: false
  })
  t.teardown(fastify.close.bind(fastify))

  await fastify.register(require('../'), {
    secret: 'a'.repeat(32),
    salt: 'a'.repeat(sodium.crypto_pwhash_SALTBYTES - 1)
  }).after((err) => {
    t.type(err, Error)
    t.equal(err.message, `salt must be length ${sodium.crypto_pwhash_SALTBYTES}`)
  })
})

tap.test('not throws when salt is greater than or equal to sodium.crypto_pwhash_SALTBYTES', async function (t) {
  t.plan(1)

  const fastify = require('fastify')({
    logger: false
  })
  t.teardown(fastify.close.bind(fastify))

  await fastify.register(require('../'), {
    secret: 'a'.repeat(32),
    salt: 'a'.repeat(sodium.crypto_pwhash_SALTBYTES)
  }).after((err) => {
    t.error(err)
  })
})

tap.test('using secret without salt', function (t) {
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

  t.teardown(fastify.close.bind(fastify))
  t.plan(5)

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

    fastify.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: response.headers['set-cookie']
      }
    }, (error, response) => {
      t.error(error)
      t.same(JSON.parse(response.payload), {
        some: 'data'
      })
    })
  })
})

tap.test('using secret with salt as string', function (t) {
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

  t.teardown(fastify.close.bind(fastify))
  t.plan(5)

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

    fastify.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: response.headers['set-cookie']
      }
    }, (error, response) => {
      t.error(error)
      t.same(JSON.parse(response.payload), {
        some: 'data'
      })
    })
  })
})

tap.test('using secret with salt as buffer', function (t) {
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

  t.teardown(fastify.close.bind(fastify))
  t.plan(5)

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

    fastify.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: response.headers['set-cookie']
      }
    }, (error, response) => {
      t.error(error)
      t.same(JSON.parse(response.payload), {
        some: 'data'
      })
    })
  })
})

tap.test('signing works with a secret', function (t) {
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
