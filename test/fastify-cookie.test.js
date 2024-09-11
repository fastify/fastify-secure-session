'use strict'

const { test } = require('node:test')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

test('not to register `@fastify/cookie` when it is already registered', async t => {
  const fastify = require('fastify')({
    logger: false
  })
  t.after(() => fastify.close())

  await fastify.register(require('@fastify/cookie'), {
    secret: 'my-secret', // for cookies signature
    parseOptions: {} // options for parsing cookies
  })

  t.assert.doesNotReject(() => fastify.register(require('../'), {
    key
  }).after())
})
