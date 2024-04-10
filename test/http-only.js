'use strict'

const tap = require('tap')
const Fastify = require('fastify')
const SecureSessionPlugin = require('../')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

tap.test('http-only override', async t => {
  const fastify = Fastify({ logger: false })
  t.teardown(fastify.close.bind(fastify))
  t.plan(3)

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

  t.equal(loginResponse.statusCode, 200)
  t.ok(loginResponse.headers['set-cookie'])
  t.not(loginResponse.headers['set-cookie'].split(';')[1].trim(), 'HttpOnly')
})

tap.test('Override global options does not change httpOnly default', t => {
  t.plan(8)
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

  t.teardown(fastify.close.bind(fastify))

  fastify.get('/', (request, reply) => {
    const data = request.session.get('data')

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
    const { maxAge, path } = response.cookies[0]
    t.equal(maxAge, 1000 * 60 * 60)
    t.equal(response.headers['set-cookie'].split(';')[3].trim(), 'HttpOnly')
    t.equal(path, '/')

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
})
