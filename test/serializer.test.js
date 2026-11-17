'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const SecureSessionPlugin = require('../')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

sodium.randombytes_buf(key)

const bigintSerializer = {
  stringify: (value) => JSON.stringify(value, (_key, v) => typeof v === 'bigint' ? { $bigint: v.toString() } : v),
  parse: (text) => JSON.parse(text, (_key, v) => v !== null && typeof v === 'object' && typeof v.$bigint === 'string' ? BigInt(v.$bigint) : v)
}

test('uses a custom serializer to store BigInt values', async t => {
  const fastify = Fastify({ logger: false })
  t.after(() => fastify.close())
  fastify.register(SecureSessionPlugin, {
    key,
    serializer: bigintSerializer
  })

  fastify.post('/', (request, reply) => {
    request.session.set('id', 9007199254740993n)
    request.session.nested = { amount: 12345678901234567890n }
    reply.send('ok')
  })

  fastify.get('/', (request, reply) => {
    const id = request.session.get('id')
    const amount = request.session.nested.amount
    reply.send({
      id: id.toString(),
      idType: typeof id,
      amount: amount.toString(),
      amountType: typeof amount
    })
  })

  const postResponse = await fastify.inject({ method: 'POST', url: '/' })
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: { cookie: postResponse.headers['set-cookie'] }
  })
  t.assert.strictEqual(getResponse.statusCode, 200)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), {
    id: '9007199254740993',
    idType: 'bigint',
    amount: '12345678901234567890',
    amountType: 'bigint'
  })
})

test('uses the custom serializer in encodeSecureSession and decodeSecureSession', async t => {
  const fastify = Fastify({ logger: false })
  t.after(() => fastify.close())

  const calls = []
  fastify.register(SecureSessionPlugin, {
    key,
    serializer: {
      stringify (value) {
        calls.push('stringify')
        return JSON.stringify(value)
      },
      parse (text) {
        calls.push('parse')
        t.assert.strictEqual(typeof text, 'string')
        return JSON.parse(text)
      }
    }
  })

  await fastify.after()

  const session = fastify.createSecureSession({ foo: 'bar' })
  const cookie = fastify.encodeSecureSession(session)
  const decoded = fastify.decodeSecureSession(cookie)

  t.assert.strictEqual(decoded.get('foo'), 'bar')
  t.assert.deepStrictEqual(calls, ['stringify', 'parse'])
})

test('uses a separate serializer per session', async t => {
  const fastify = Fastify({ logger: false })
  t.after(() => fastify.close())

  const key2 = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key2)

  fastify.register(SecureSessionPlugin, [
    { sessionName: 'session', key },
    { sessionName: 'bigSession', key: key2, serializer: bigintSerializer }
  ])

  await fastify.after()

  const plain = fastify.createSecureSession({ id: 1n })
  t.assert.throws(() => fastify.encodeSecureSession(plain, 'session'), /BigInt/)

  const big = fastify.createSecureSession({ id: 1n })
  const cookie = fastify.encodeSecureSession(big, 'bigSession')
  t.assert.strictEqual(fastify.decodeSecureSession(cookie, undefined, 'bigSession').get('id'), 1n)
})

test('throws when serializer is missing stringify or parse', async t => {
  const fastify = Fastify({ logger: false })
  t.after(() => fastify.close())
  fastify.register(SecureSessionPlugin, {
    key,
    serializer: { stringify: JSON.stringify }
  })

  await t.assert.rejects(() => fastify.after(), /serializer must have stringify and parse functions/)
})
