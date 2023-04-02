'use strict'

const t = require('tap')
const fastify = require('fastify')({ logger: false })
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

sodium.randombytes_buf(key)

fastify.register(require('../'), {
  sessionName: 'barfoo',
  cookieName: 'foobar',
  key
})

fastify.post('/', (request, reply) => {
  request.barfoo.set('data', request.body)
  reply.send('hello world')
})

t.teardown(fastify.close.bind(fastify))
t.plan(6)

fastify.get('/', (request, reply) => {
  const data = request.barfoo.get('data')
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
  const { name } = response.cookies[0]
  t.equal(name, 'foobar')

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
