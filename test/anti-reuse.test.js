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

test('Anti re-use should still allow touch() to work', async t => {
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
    request.session.touch()
    reply.send('hello world')
  })

  fastify.get('/', (request, reply) => {
    const some = request.session.get('some')
    const some2 = request.session.get('some2')
    reply.send({ some, some2 })
  })

  const payload = {
    some: 'someData',
    some2: { a: 1, b: 2, c: 3 }
  }

  const firstPostResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload
  })
  const oldCookie = firstPostResponse.headers['set-cookie']

  t.assert.ok(firstPostResponse)
  t.assert.strictEqual(firstPostResponse.statusCode, 200)
  t.assert.ok(firstPostResponse.headers['set-cookie'])

  clock.jump('00:14:59') // forward just before expiry

  const secondPostResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload
  })
  const newCookie = secondPostResponse.headers['set-cookie']

  t.assert.ok(secondPostResponse)
  t.assert.strictEqual(secondPostResponse.statusCode, 200)
  t.assert.ok(secondPostResponse.headers['set-cookie'])

  clock.jump('00:00:02') // forward just after expiry

  const withNewCookie = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: newCookie
    }
  })

  t.assert.ok(withNewCookie)

  // this should return the payload because the cookie was updated 2 seconds before
  t.assert.deepStrictEqual(JSON.parse(withNewCookie.payload), payload)

  const withOldCookie = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: oldCookie
    }
  })

  t.assert.ok(withOldCookie)

  // this should be empty because the old session is expired
  t.assert.deepStrictEqual(JSON.parse(withOldCookie.payload), {})
})
