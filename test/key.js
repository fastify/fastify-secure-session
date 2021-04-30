'use strict'

const t = require('tap')
const fastify = require('fastify')({ logger: false })
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

sodium.randombytes_buf(key)

fastify.register(require('../'), {
  key
})

fastify.post('/', (request, reply) => {
  request.session.set('data', request.body)
  reply.send('hello world')
})

t.teardown(fastify.close.bind(fastify))
t.plan(9)

fastify.get('/', (request, reply) => {
  const data = request.session.get('data')
  if (!data) {
    reply.code(404).send()
    return
  }
  reply.send(data)
})

fastify.inject({
  method: 'POST',
  url: '/',
  payload: {
    some: 'data'
  }
}, (error, response) => {
  t.error(error)
  t.equal(response.statusCode, 200)
  t.ok(response.headers['set-cookie'])
  const { name } = response.cookies[0]
  t.equal(name, 'session')

  fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: response.headers['set-cookie']
    }
  }, (error, response) => {
    t.error(error)
    t.same(JSON.parse(response.payload), { some: 'data' })
  })
})

t.test('plugin should propagate error when given a key that is not an array, string, or buffer', t => {
  t.plan(2)

  const secureSession = t.mock('..', {
    'fastify-plugin': (secureSession) => {
      return secureSession
    }
  })

  secureSession({}, { key: 13 }, (err) => {
    t.equal(err instanceof Error, true)
    t.equal(err.message, 'key must be a string or a Buffer')
  })
})

t.test('plugin should propagate an error when given a string/buffer key that is shorter than sodium.crypto_secretbox_KEYBYTES', t => {
  t.plan(2)

  const secureSession = t.mock('..', {
    'fastify-plugin': (secureSession) => {
      return secureSession
    }
  })

  secureSession({}, { key: Buffer.alloc(sodium.crypto_secretbox_KEYBYTES - 1) }, (err) => {
    t.equal(err instanceof Error, true)
    t.equal(err.message, `key must be at least ${sodium.crypto_secretbox_KEYBYTES} bytes`)
  })
})

t.test('plugin should propagate an error when given a key array that contains keys shorter than sodium.crypto_secretbox_KEYBYTES', t => {
  t.plan(2)

  const secureSession = t.mock('..', {
    'fastify-plugin': (secureSession) => {
      return secureSession
    }
  })

  secureSession(
    {},
    { key: [Buffer.alloc(sodium.crypto_secretbox_KEYBYTES), Buffer.alloc(sodium.crypto_secretbox_KEYBYTES - 1)] },
    (err) => {
      t.equal(err instanceof Error, true)
      t.equal(err.message, `key lengths must be at least ${sodium.crypto_secretbox_KEYBYTES} bytes`)
    })
})
