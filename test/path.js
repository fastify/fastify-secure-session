'use strict'

const t = require('tap')
const fastify = require('fastify')({ logger: false })
const sodium = require('sodium-native')
const cookie = require('cookie')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

sodium.randombytes_buf(key)

fastify.register(require('../'), {
  key,
  cookie: {
    path: '/'
  }
})

t.teardown(fastify.close.bind(fastify))
t.plan(4)

fastify.post('/auth', (request, reply) => {
  request.session.set('data', request.body)
  request.session.data2 = request.body
  reply.send('hello world')
})

fastify.get('/', (request, reply) => {
  const data = request.session.get('data')
  const data2 = request.session.data2
  if (!data || !data2) {
    reply.code(404).send()
    return
  }
  reply.send({ data, data2 })
})

fastify.inject({
  method: 'POST',
  url: '/auth',
  payload: {
    some: 'data'
  }
}, (err, response) => {
  t.error(err)
  t.equal(response.statusCode, 200)
  t.ok(response.headers['set-cookie'])
  t.equal(cookie.parse(response.headers['set-cookie']).Path, '/')
})
