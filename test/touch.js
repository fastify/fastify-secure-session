'use strict'

const tap = require('tap')
const sodium = require('sodium-native')
const cookie = require('cookie')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

tap.test('Sends cookies when touch is invoked and session data has not changed', async t => {
  const maxAge = 3600
  const fastify = require('fastify')({ logger: false })
  t.teardown(fastify.close.bind(fastify))
  t.plan(8)

  await fastify.register(require('../'), {
    key,
    cookie: {
      path: '/',
      maxAge
    }
  })

  fastify.post('/login', (request, reply) => {
    request.session.set('user', request.body.email)
    reply.send('Welcome back!')
  })

  fastify.get('/ping', (request, reply) => {
    request.session.touch()
    reply.send('pong')
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
  t.equal(cookie.parse(loginResponse.headers['set-cookie']).Path, '/')
  t.equal(cookie.parse(loginResponse.headers['set-cookie'])['Max-Age'], `${maxAge}`)

  const pingResponse = await fastify.inject({
    method: 'GET',
    url: '/ping'
  })

  t.equal(pingResponse.statusCode, 200)
  t.ok(pingResponse.headers['set-cookie'])
  t.equal(cookie.parse(loginResponse.headers['set-cookie']).Path, '/')
  t.equal(cookie.parse(loginResponse.headers['set-cookie'])['Max-Age'], `${maxAge}`)
})
