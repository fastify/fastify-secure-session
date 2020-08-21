'use strict'

const fastify = require('fastify')({ logger: false })
const t = require('tap')
const Session = require('../').Session
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

t.tearDown(fastify.close.bind(fastify))

t.test('it exposes decorators for other libraries to use', async () => {
  await fastify.register(require('../'), {
    key
  })
  t.ok(fastify.encodeSecureSession(new Session({ foo: 'bar' })))
  t.ok(fastify.encodeSecureSession(new Session({})))
  t.notEqual(fastify.encodeSecureSession(new Session({ foo: 'bar' })), fastify.encodeSecureSession(new Session({})))

  const cookie = fastify.encodeSecureSession(new Session({ foo: 'bar' }))
  const decoded = fastify.decodeSecureSession(cookie)
  t.equal(decoded.get('foo'), 'bar')
  t.type(decoded.get('somethingElse'), 'undefined')

  t.equal(fastify.decodeSecureSession('bogus'), null)
})
