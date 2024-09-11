'use strict'

const { test } = require('node:test')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

test('Clears the session data except for specified keys when regenerate is called', async t => {
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
    request.session.set('user', request.body.user)
    request.session.set('email', request.body.email)
    reply.send('Welcome back!')
  })

  fastify.get('/regen', (request, reply) => {
    let ignoredKeys
    if (request.query.key) {
      if (Array.isArray(request.query.key)) {
        ignoredKeys = request.query.key
      } else {
        ignoredKeys = [request.query.key]
      }
    }
    request.session.regenerate(ignoredKeys)
    reply.send('regenerated')
  })

  fastify.get('/session', (request, reply) => {
    reply.send(request.session.data())
  })

  const loginResponse = await fastify.inject({
    method: 'POST',
    url: '/login',
    payload: {
      user: 'username',
      email: 'me@here.fine'
    }
  })

  const sessionResponse = await fastify.inject({
    method: 'GET',
    url: '/session',
    headers: {
      cookie: loginResponse.headers['set-cookie']
    }
  })

  t.assert.deepStrictEqual(sessionResponse.json(), {
    user: 'username',
    email: 'me@here.fine'
  })

  const regeneratePartialResponse = await fastify.inject({
    method: 'GET',
    url: '/regen?key=user',
    headers: {
      cookie: loginResponse.headers['set-cookie']
    }
  })

  const sessionAfterRegenPartialResponse = await fastify.inject({
    method: 'GET',
    url: '/session',
    headers: {
      cookie: regeneratePartialResponse.headers['set-cookie']
    }
  })

  t.assert.deepStrictEqual(sessionAfterRegenPartialResponse.json(), {
    user: 'username'
  })

  const regenerateAllResponse = await fastify.inject({
    method: 'GET',
    url: '/regen',
    headers: {
      cookie: loginResponse.headers['set-cookie']
    }
  })

  const sessionAfterRegenAllResponse = await fastify.inject({
    method: 'GET',
    url: '/session',
    headers: {
      cookie: regenerateAllResponse.headers['set-cookie']
    }
  })
  t.assert.deepStrictEqual(sessionAfterRegenAllResponse.json(), {})
})
