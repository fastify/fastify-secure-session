'use strict'

const t = require('tap')
const fastify = require('fastify')({ logger: false })
const sodium = require('sodium-native')
const FakeTimers = require('@sinonjs/fake-timers')
const clock = FakeTimers.install({
  shouldAdvanceTime: true,
  now: Date.now()
})

const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

fastify.register(require('../'), {
  key,
  expiry: 15 * 60 // 15 minutes
})

fastify.post('/', (request, reply) => {
  request.session.set('some', request.body.some)
  request.session.set('some2', request.body.some2)
  reply.send('hello world')
})

t.teardown(fastify.close.bind(fastify))
t.plan(5)

fastify.get('/', (request, reply) => {
  const some = request.session.get('some')
  const some2 = request.session.get('some2')
  reply.send({ some, some2 })
})

fastify.inject({
  method: 'POST',
  url: '/',
  payload: {
    some: 'someData',
    some2: { a: 1, b: undefined, c: 3 }
  }
}, (error, response) => {
  t.error(error)
  t.equal(response.statusCode, 200)
  t.ok(response.headers['set-cookie'])

  clock.jump('00:15:01') // default validity is 24 hours

  fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: response.headers['set-cookie']
    }
  }, (error, response) => {
    t.error(error)
    t.same(JSON.parse(response.payload), {})
    clock.reset()
    clock.uninstall()
    fastify.close()
  })
})
