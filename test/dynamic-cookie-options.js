'use strict'

const t = require('tap')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const SecureSessionPlugin = require('../')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

t.test('Custom options', t => {
  t.plan(6)
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data', request.body)
    request.session.options({ maxAge: 1000 * 60 * 60 })
    reply.send('hello world')
  })

  t.teardown(fastify.close.bind(fastify))

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
    const { maxAge } = response.cookies[0]
    t.equal(maxAge, 1000 * 60 * 60)

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

t.test('Override global options', t => {
  t.plan(7)
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

  t.teardown(fastify.close.bind(fastify))

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
    const { maxAge, path } = response.cookies[0]
    t.equal(maxAge, 1000 * 60 * 60)
    t.equal(path, '/')

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
