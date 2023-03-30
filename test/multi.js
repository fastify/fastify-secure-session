'use strict'

const t = require('tap')
const fastify = require('fastify')({ logger: false })
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
const SecureSession = require('../')

sodium.randombytes_buf(key)

fastify.register(SecureSession, {
  secret: 'top_secret aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  cookie: {
    path: '/',
    maxAge: 3600
  },
  fieldName: 'longTermSession'
})

fastify.register(SecureSession, {
  secret: 'VS-nfD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  cookieName: 'short-term-cookie',
  cookie: {
    path: '/',
    maxAge: 60
  },
  fieldName: 'shortTermSession'
})

fastify.post('/', (request, reply) => {
  request.longTermSession.set('data', request.body)
  request.shortTermSession.set('information', 'Lorem Ipsum')

  reply.send('hello world')
})

t.teardown(fastify.close.bind(fastify))
t.plan(8)

fastify.get('/', (request, reply) => {
  const data = request.longTermSession.get('data')
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
  t.equal(response.cookies.length, 2)
  t.equal(response.cookies[0].name, 'longTermSession')
  t.equal(response.cookies[1].name, 'short-term-cookie')

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
