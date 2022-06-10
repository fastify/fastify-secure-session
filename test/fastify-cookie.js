'use strict'

const tap = require('tap')
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

tap.test('not to register `@fastify/cookie` when it is already registered', async t => {
  t.plan(1)

  const fastify = require('fastify')({
    logger: false
  })
  t.teardown(fastify.close.bind(fastify))

  await fastify.register(require('@fastify/cookie'), {
    secret: 'my-secret', // for cookies signature
    parseOptions: {} // options for parsing cookies
  }).register(require('../'), {
    key
  }).after(err => t.error(err))
})
