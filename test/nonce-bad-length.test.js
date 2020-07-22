'use strict'

const t = require('tap')
const fastify = require('fastify')({ logger: false })
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

sodium.randombytes_buf(key)

fastify.register(require('../'), {
  key
})

fastify.get('/get', (request, reply) => {
  const data = request.session.get('data')
  reply.send(data)
})

fastify.get('/set', (request, reply) => {
  request.session.set('data', { hello: 'world' })
  reply.send('hello world')
})

t.tearDown(fastify.close.bind(fastify))
t.plan(5)

fastify.inject({
  method: 'GET',
  url: '/set'
}, (error, response) => {
  t.error(error)
  t.equal(response.statusCode, 200)
  const cookie = response.cookies[0]

  fastify.inject({
    method: 'GET',
    url: '/get',
    cookies: {
      [cookie.name]: cookie.value + 'a'.repeat(10)
    }
  }, (error, response) => {
    t.error(error)
    t.equal(response.statusCode, 200)
    // the session is empty, so we expect an empty string
    t.equal(response.payload, '')
  })
})
