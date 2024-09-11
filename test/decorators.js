'use strict'

const { test } = require('node:test')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

test('it exposes encode and decode decorators for other libraries to use', async t => {
  const fastify = require('fastify')({
    logger: false
  })
  t.after(() => fastify.close())

  await fastify.register(require('../'), {
    key
  })

  const session = fastify.createSecureSession({ foo: 'bar' })
  t.assert.strictEqual(session.get('foo'), 'bar')
  t.assert.strictEqual(typeof session.get('somethingElse'), 'undefined')

  t.assert.ok(fastify.encodeSecureSession(fastify.createSecureSession({ foo: 'bar' })))
  t.assert.ok(fastify.encodeSecureSession(fastify.createSecureSession({})))
  t.assert.notEqual(fastify.encodeSecureSession(fastify.createSecureSession({ foo: 'bar' })), fastify.encodeSecureSession(fastify.createSecureSession({})))

  t.assert.throws(() => fastify.encodeSecureSession(fastify.createSecureSession({ foo: 'bar' }), 'key-does-not-exist'))
  t.assert.throws(() => fastify.decodeSecureSession('bogus', undefined, 'key-does-not-exist'))

  const cookie = fastify.encodeSecureSession(fastify.createSecureSession({ foo: 'bar' }))
  const decoded = fastify.decodeSecureSession(cookie)
  t.assert.strictEqual(decoded.get('foo'), 'bar')
  t.assert.strictEqual(typeof decoded.get('somethingElse'), 'undefined')

  t.assert.strictEqual(fastify.decodeSecureSession('bogus'), null)
})

test('creates an empty session when the cipher is not long enough', async t => {
  t.plan(1)

  const fastify = require('fastify')({
    logger: false
  })
  t.after(() => fastify.close())

  await fastify.register(require('../'), {
    key
  })

  const buf = Buffer.alloc(sodium.crypto_secretbox_MACBYTES - 1)
  sodium.randombytes_buf(buf)

  fastify.decodeSecureSession(`${buf.toString('base64')};`, {
    debug: (msg) => {
      t.assert.strictEqual(msg, '@fastify/secure-session: the cipher is not long enough, creating an empty session')
    }
  })
})

test('creates an empty session when decryption fails', async t => {
  t.plan(1)

  const fastify = require('fastify')({
    logger: false
  })
  t.after(() => fastify.close())

  await fastify.register(require('../'), {
    key
  })

  const buf = Buffer.alloc(sodium.crypto_secretbox_MACBYTES)
  sodium.randombytes_buf(buf)

  const buf2 = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES)
  sodium.randombytes_buf(buf2)

  fastify.decodeSecureSession(`${buf.toString('base64')};${buf2.toString('base64')}`, {
    debug: (msg) => {
      t.assert.strictEqual(msg, '@fastify/secure-session: unable to decrypt, creating an empty session')
    }
  })
})
