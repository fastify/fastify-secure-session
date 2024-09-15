'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const SecureSessionPlugin = require('../')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

test('http-only override', async t => {
  const fastify = Fastify({ logger: false })
  t.after(() => fastify.close())

  await fastify.register(SecureSessionPlugin, {
    key,
    cookie: {
      path: '/',
      httpOnly: false
    }
  })

  fastify.post('/login', (request, reply) => {
    request.session.set('user', request.body.email)
    reply.send('Welcome back!')
  })

  const loginResponse = await fastify.inject({
    method: 'POST',
    url: '/login',
    payload: {
      email: 'me@here.fine'
    }
  })
  t.assert.ok(loginResponse)
  t.assert.strictEqual(loginResponse.statusCode, 200)
  t.assert.ok(loginResponse.headers['set-cookie'])
  t.assert.notEqual(loginResponse.headers['set-cookie'].split(';')[1].trim(), 'HttpOnly')
})

test('Override global options does not change httpOnly default', async t => {
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

  t.after(() => fastify.close())

  fastify.get('/', (request, reply) => {
    const data = request.session.get('data')

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
  const { maxAge, path } = postResponse.cookies[0]
  t.assert.strictEqual(maxAge, 1000 * 60 * 60)
  t.assert.strictEqual(postResponse.headers['set-cookie'].split(';')[3].trim(), 'HttpOnly')
  t.assert.strictEqual(path, '/')

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })
  t.assert.ok(getResponse)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), { some: 'data' })
})
