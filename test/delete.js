'use strict'

const t = require('tap')
const fastify = require('fastify')({ logger: false })
const sodium = require('sodium-native')
const cookie = require('cookie')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
const expires = new Date(Date.now() + (86400 * 1000))
const expiresUTC = expires.toUTCString()

sodium.randombytes_buf(key)

fastify.register(require('../'), {
  key,
  cookie: {
    path: '/',
    expires,
    maxAge: 86400
  }
})

fastify.post('/', (request, reply) => {
  // using setters
  request.session.set('some', request.body.some)
  request.session.set('some2', request.body.some2)

  // setting natively
  request.session.some3 = request.body.some3
  request.session.some4 = request.body.some4

  reply.send('hello world')
})

fastify.post('/delete', (request, reply) => {
  request.session.delete()
  reply.send('hello world')
})

t.teardown(fastify.close.bind(fastify))
t.plan(14)

fastify.get('/', (request, reply) => {
  const some = request.session.get('some')
  const some2 = request.session.get('some2')
  const some3 = request.session.get('some3')
  const some4 = request.session.get('some4')
  if (!some || !some2 || !some3 || !some4) {
    reply.code(404).send()
    return
  }
  reply.send({ some, some2, some3, some4 })
})

fastify.inject({
  method: 'POST',
  url: '/',
  payload: {
    some: 'someData',
    some2: { a: 1, b: undefined, c: 3 },
    some3: { test1: true },
    some4: { test2: true }
  }
}, (error, response) => {
  t.error(error)
  t.equal(response.statusCode, 200)
  t.ok(response.headers['set-cookie'])
  t.equal(cookie.parse(response.headers['set-cookie']).Path, '/')
  t.equal(cookie.parse(response.headers['set-cookie']).Expires, expiresUTC)
  t.equal(cookie.parse(response.headers['set-cookie'])['Max-Age'], '86400')

  fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: response.headers['set-cookie']
    }
  }, (error, response) => {
    t.error(error)
    t.same(
      JSON.parse(response.payload),
      { some: 'someData', some2: { a: 1, c: 3 }, some3: { test1: true }, some4: { test2: true } }
    )

    fastify.inject({
      method: 'POST',
      url: '/delete'
    }, (error, response) => {
      t.error(error)
      t.equal(response.statusCode, 200)
      t.ok(response.headers['set-cookie'])
      t.equal(cookie.parse(response.headers['set-cookie']).Path, '/')
      t.equal(cookie.parse(response.headers['set-cookie']).Expires, 'Thu, 01 Jan 1970 00:00:00 GMT')
      t.equal(cookie.parse(response.headers['set-cookie'])['Max-Age'], '0')
    })
  })
})
