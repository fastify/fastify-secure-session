'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const FakeTimers = require('@sinonjs/fake-timers')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

test('Anti re-use with default expiry (24 hours)', async t => {
  const fastify = Fastify({ logger: false })
  const clock = FakeTimers.install({
    shouldAdvanceTime: true,
    now: Date.now()
  })
  t.after(() => {
    fastify.close()
    clock.reset()
    clock.uninstall()
  })

  fastify.register(require('../'), {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('some', request.body.some)
    request.session.set('some2', request.body.some2)
    reply.send('hello world')
  })

  fastify.get('/', (request, reply) => {
    const some = request.session.get('some')
    const some2 = request.session.get('some2')
    reply.send({ some, some2 })
  })

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      some: 'someData',
      some2: { a: 1, b: undefined, c: 3 }
    }
  })

  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])

  clock.jump('24:01:00') // default expiry is 24 hours

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })

  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), {})
})

test('Anti re-use with set expiry of 15 minutes', async t => {
  const fastify = Fastify({ logger: false })
  const clock = FakeTimers.install({
    shouldAdvanceTime: true,
    now: Date.now()
  })
  t.after(() => {
    fastify.close()
    clock.reset()
    clock.uninstall()
  })

  fastify.register(require('../'), {
    key,
    expiry: 15 * 60 // 15 minutes
  })

  fastify.post('/', (request, reply) => {
    request.session.set('some', request.body.some)
    request.session.set('some2', request.body.some2)
    reply.send('hello world')
  })

  fastify.get('/', (request, reply) => {
    const some = request.session.get('some')
    const some2 = request.session.get('some2')
    reply.send({ some, some2 })
  })

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      some: 'someData',
      some2: { a: 1, b: undefined, c: 3 }
    }
  })

  t.assert.ok(postResponse)
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])

  clock.jump('00:15:01') // forward 15 minutes + 1

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })

  t.assert.ok(getResponse)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), {})
})
