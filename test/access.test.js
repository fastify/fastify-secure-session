'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const SecureSessionPlugin = require('../')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

test('Native getting and settings props and getter and setter method both work', async t => {
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data1', request.body)
    request.session.data2 = request.body

    reply.send('hello world')
  })

  t.after(() => fastify.close())

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

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      some: 'data'
    }
  })
  t.assert.ok(postResponse)
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })

  t.assert.ok(getResponse)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), {
    data1: { some: 'data' },
    data2: { some: 'data' },
    data3: { some: 'data' },
    data4: { some: 'data' }
  })
})

test('Get all data that we set in session', async t => {
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data1', request.body)
    request.session.data2 = request.body

    reply.send('hello world')
  })

  t.after(() => fastify.close())

  fastify.get('/', (request, reply) => {
    const data = request.session.data()

    if (!data) {
      reply.code(404).send()
      return
    }

    reply.send(data)
  })

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      some: 'data'
    }
  })
  t.assert.ok(postResponse)
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })
  t.assert.ok(getResponse)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), {
    data1: { some: 'data' },
    data2: { some: 'data' }
  })
})

test('session is changed', async t => {
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data1', request.body)
    request.session.data2 = request.body

    const changed = request.session.changed

    if (!changed) {
      reply.code(404).send()
      return
    }

    reply.send(changed)
  })

  t.after(() => fastify.close())

  fastify.get('/', (request, reply) => {
    const changed = request.session.changed

    if (changed) { // changed should be false, as session has not been changed here
      reply.code(500).send()
      return
    }

    reply.send(changed)
  })

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      some: 'data'
    }
  })

  t.assert.ok(postResponse)
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])
  t.assert.deepStrictEqual(JSON.parse(postResponse.payload), true)

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })

  t.assert.ok(getResponse)
  t.assert.strictEqual(getResponse.headers['set-cookie'], undefined) // new cookie should not be issued, since session is unchanged
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), false)
})

test('session is deleted', async t => {
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data1', request.body)
    request.session.data2 = request.body

    reply.send('hello world')
  })

  fastify.post('/delete', (request, reply) => {
    request.session.delete()
    const deleted = request.session.deleted

    reply.send(deleted)
  })

  t.after(() => fastify.close())

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      some: 'data'
    }
  })
  t.assert.ok(postResponse)
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])

  const getResponse = await fastify.inject({
    method: 'POST',
    url: '/delete',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })
  t.assert.ok(getResponse)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), true)
})
