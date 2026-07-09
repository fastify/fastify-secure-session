'use strict'

const { test } = require('node:test')
const sodium = require('sodium-native')
const { parseSetCookie } = require('cookie')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

test('Sends cookies when touch is invoked and session data has not changed', async (t) => {
  const maxAge = 3600
  const fastify = require('fastify')({ logger: false })
  t.after(() => fastify.close())

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

  t.assert.strictEqual(loginResponse.statusCode, 200)
  t.assert.ok(loginResponse.headers['set-cookie'])
  t.assert.strictEqual(
    parseSetCookie(loginResponse.headers['set-cookie']).path,
    '/'
  )
  t.assert.strictEqual(
    parseSetCookie(loginResponse.headers['set-cookie']).maxAge,
    maxAge
  )

  const pingResponse = await fastify.inject({
    method: 'GET',
    url: '/ping'
  })

  t.assert.strictEqual(pingResponse.statusCode, 200)
  t.assert.ok(pingResponse.headers['set-cookie'])
  t.assert.strictEqual(
    parseSetCookie(loginResponse.headers['set-cookie']).path,
    '/'
  )
  t.assert.strictEqual(
    parseSetCookie(loginResponse.headers['set-cookie']).maxAge,
    maxAge
  )
})
