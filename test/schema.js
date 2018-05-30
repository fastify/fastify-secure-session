'use strict'

const t = require('tap')
const fastify = require('fastify')({ logger: false })
const sodium = require('sodium-native')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)

sodium.randombytes_buf(key)

fastify.register(require('../'), {
  key
})

const schema = {
  body: {
    type: 'object',
    properties: {
      foo: { type: 'string' }
    },
    required: ['foo']
  }
}

fastify.post('/', { schema }, (request, reply) => {
  request.session.set('data', request.body)
  reply.send('hello world')
})

t.tearDown(fastify.close.bind(fastify))
t.plan(6)

fastify.inject({
  method: 'POST',
  url: '/',
  payload: {
    bar: 'baz'
  }
}, (error, response) => {
  t.error(error)
  t.equal(response.statusCode, 400)
  t.notOk(response.headers['set-cookie'])

  fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      foo: 'bar'
    }
  }, (error, response) => {
    t.error(error)
    t.equal(response.payload, 'hello world')
    t.ok(response.headers['set-cookie'])
  })
})
