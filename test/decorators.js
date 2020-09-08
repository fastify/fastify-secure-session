'use strict'

const fastify = require('fastify')({ logger: false })
const t = require('tap')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

t.tearDown(fastify.close.bind(fastify))

t.test('it exposes encode and decode decorators for other libraries to use', async () => {
  await fastify.register(require('../'), {
    key
  })

  const session = fastify.createSecureSession({ foo: 'bar' })
  t.equal(session.get('foo'), 'bar')
  t.type(session.get('somethingElse'), 'undefined')

  t.ok(fastify.encodeSecureSession(fastify.createSecureSession({ foo: 'bar' })))
  t.ok(fastify.encodeSecureSession(fastify.createSecureSession({})))
  t.notEqual(fastify.encodeSecureSession(fastify.createSecureSession({ foo: 'bar' })), fastify.encodeSecureSession(fastify.createSecureSession({})))

  const cookie = fastify.encodeSecureSession(fastify.createSecureSession({ foo: 'bar' }))
  const decoded = fastify.decodeSecureSession(cookie)
  t.equal(decoded.get('foo'), 'bar')
  t.type(decoded.get('somethingElse'), 'undefined')

  t.equal(fastify.decodeSecureSession('bogus'), null)
})
