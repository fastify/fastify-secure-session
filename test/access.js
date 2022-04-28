'use strict'

const t = require('tap')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const SecureSessionPlugin = require('../')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

t.test('Native gettting and settings props and getter and setter method both work', t => {
  t.plan(5)
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data1', request.body)
    request.session.data2 = request.body

    reply.send('hello world')
  })

  t.teardown(fastify.close.bind(fastify))

  fastify.get('/', (request, reply) => {
    const data1 = request.session.get('data1')
    const data2 = request.session.data1

    const data3 = request.session.data2
    const data4 = request.session.get('data2')

    if (!data1 || !data2 || !data3 || !data4) {
      reply.code(404).send()
      return
    }
    reply.send({ data1, data2, data3, data4 })
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
        data1: { some: 'data' },
        data2: { some: 'data' },
        data3: { some: 'data' },
        data4: { some: 'data' }
      })
    })
  })
})

t.test('Get all data that we set in session', t => {
  t.plan(5)
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data1', request.body)
    request.session.data2 = request.body

    reply.send('hello world')
  })

  t.teardown(fastify.close.bind(fastify))

  fastify.get('/', (request, reply) => {
    const data = request.session.data()

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
        data1: { some: 'data' },
        data2: { some: 'data' }
      })
    })
  })
})
