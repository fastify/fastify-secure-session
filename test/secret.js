'use strict'

const tap = require('tap')

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

tap.test('plugin should propagate error when fed a secret that is shorter than 32 bytes', function (t) {
  t.plan(1)

  const secureSession = t.mock('..', {
    'fastify-plugin': function (secureSession) {
      return secureSession
    }
  })

  const shortSecret = Buffer.alloc(16)

  secureSession({}, { secret: shortSecret }, function next (err) {
    t.equal(err instanceof Error, true)
  })
})

tap.test('plugin should propagate error when fed a salt that is shorter than sodium.crypto_pwhash_SALTBYTES', function (t) {
  t.plan(1)

  const secureSession = t.mock('..', {
    'fastify-plugin': function (secureSession) {
      return secureSession
    }
  })

  const secret = 'averylogphrasebiggerthanthirtytwochars'
  const shortSalt = Buffer.from('mq9hDxBVDbsp', 'ascii')

  secureSession({}, { secret: secret, salt: shortSalt }, function next (err) {
    t.equal(err instanceof Error, true)
  })
})
