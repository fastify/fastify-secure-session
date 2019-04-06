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

  t.tearDown(fastify.close.bind(fastify))
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
      t.deepEqual(JSON.parse(response.payload), {
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

  t.tearDown(fastify.close.bind(fastify))
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
      t.deepEqual(JSON.parse(response.payload), {
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

  t.tearDown(fastify.close.bind(fastify))
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
      t.deepEqual(JSON.parse(response.payload), {
        some: 'data'
      })
    })
  })
})
