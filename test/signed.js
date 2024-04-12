'use strict'

const tap = require('tap')
const fastify = require('fastify')({ logger: false })
const sodium = require('sodium-native')

tap.test('signed session cookie should works if not tampered with', function (t) {
  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.randombytes_buf(key)

  fastify.register(require('../'), {
    key,
    cookieName: '__Host-session',
    cookie: {
      secure: true,
      httpOnly: true,
      path: '/',
      signed: true
    }
  })

  fastify.post('/', (request, reply) => {
    request.session.set('userId', '123')
    reply.send('done')
  })

  t.teardown(fastify.close.bind(fastify))
  t.plan(7)

  fastify.get('/', (request, reply) => {
    const data = request.session.get('userId')
    if (!data) {
      reply.code(404).send()
      return
    }
    reply.send(data)
  })

  fastify.inject(
    {
      method: 'POST',
      url: '/',
      payload: {}
    },
    (error, response) => {
      t.error(error)
      t.equal(response.statusCode, 200)
      t.ok(response.headers['set-cookie'])

      const { name } = response.cookies[0]
      t.equal(name, '__Host-session')

      const originalCookie = response.headers['set-cookie']

      fastify.inject(
        {
          method: 'GET',
          url: '/',
          headers: {
            cookie: originalCookie
          }
        },
        (error, response) => {
          t.error(error)
          t.same(response.payload, '123')
        }
      )

      const cookieContent = originalCookie.split(';')[0]

      // Change the last 5 characters to AAAAA, to tamper with the cookie
      const cookieContentTampered = cookieContent.slice(0, -5) + 'AAAAA'

      const tamperedCookie = originalCookie.replace(cookieContent, cookieContentTampered)

      fastify.inject(
        {
          method: 'GET',
          url: '/',
          headers: {
            cookie: tamperedCookie
          }
        },
        (error, response) => {
          if (error) {
            t.fail('Unexpected error: ' + error.message)
          } else {
            t.equal(response.statusCode, 404, 'Should fail with tampered cookie')
          }
        }
      )
    }
  )
})
