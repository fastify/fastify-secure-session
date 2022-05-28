'use strict'

const tap = require('tap')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

tap.test('it exposes encode and decode decorators for other libraries to use', async t => {
  t.plan(8)

  const fastify = require('fastify')({
    logger: false
  })
  t.teardown(fastify.close.bind(fastify))

  await fastify.register(require('../'), {
    key
  })

  const session = fastify.createSecureSession({ foo: 'bar' })
  t.equal(session.get('foo'), 'bar')
  t.type(session.get('somethingElse'), 'undefined')

  t.ok(fastify.encodeSecureSession(fastify.createSecureSession({ foo: 'bar' })))
  t.ok(fastify.encodeSecureSession(fastify.createSecureSession({})))
  t.not(fastify.encodeSecureSession(fastify.createSecureSession({ foo: 'bar' })), fastify.encodeSecureSession(fastify.createSecureSession({})))

  const cookie = fastify.encodeSecureSession(fastify.createSecureSession({ foo: 'bar' }))
  const decoded = fastify.decodeSecureSession(cookie)
  t.equal(decoded.get('foo'), 'bar')
  t.type(decoded.get('somethingElse'), 'undefined')

  t.equal(fastify.decodeSecureSession('bogus'), null)
})

tap.test('creates an empty session when the cipher is not long enough', async t => {
  t.plan(1)

  const fastify = require('fastify')({
    logger: false
  })
  t.teardown(fastify.close.bind(fastify))

  await fastify.register(require('../'), {
    key
  })

  fastify.decodeSecureSession('a;bb', {
    debug: (msg) => {
      t.equal(msg, 'fastify-secure-session: the cipher is not long enough, creating an empty session')
    }
  })
})
