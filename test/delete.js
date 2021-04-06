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
    expires: expires,
    maxAge: 86400
  }
})

fastify.post('/', (request, reply) => {
  request.session.set('some', request.body.some)
  request.session.set('some2', request.body.some2)
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
  if (!some || !some2) {
    reply.code(404).send()
    return
  }
  reply.send({ some: some, some2: some2 })
})

fastify.inject({
  method: 'POST',
  url: '/',
  payload: {
    some: 'someData',
    some2: { a: 1, b: undefined, c: 3 }
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
    t.same(JSON.parse(response.payload), { some: 'someData', some2: { a: 1, c: 3 } })

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
