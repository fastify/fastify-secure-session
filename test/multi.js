'use strict'

const tap = require('tap')

tap.test('it should handle multiple sessions properly', t => {
  const fastify = require('fastify')({
    logger: false
  })

  fastify.register(require('../'), [{
    secret: 'top_secret aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    cookie: {
      path: '/',
      maxAge: 3600
    },
    sessionName: 'longTermSession'
  }, {
    secret: 'VS-nfD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    cookieName: 'short-term-cookie',
    cookie: {
      path: '/',
      maxAge: 60,
      domain: 'fastify.dev'
    },
    sessionName: 'shortTermSession'
  }])

  fastify.post('/', (request, reply) => {
    request.longTermSession.set('data', request.body)
    request.shortTermSession.set('information', 'Lorem Ipsum')

    reply.send('hello world')
  })

  fastify.post('/delete', (request, reply) => {
    request.longTermSession.set('data', request.body)
    request.shortTermSession.delete()

    reply.send('hello world')
  })

  t.teardown(fastify.close.bind(fastify))
  t.plan(19)

  fastify.get('/', (request, reply) => {
    const data = request.longTermSession.get('data')
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
    t.equal(response.cookies.length, 2)
    t.equal(response.cookies[0].name, 'longTermSession')
    t.equal(response.cookies[0].maxAge, 3600)
    t.equal(response.cookies[0].domain, undefined)

    t.equal(response.cookies[1].name, 'short-term-cookie')
    t.equal(response.cookies[1].maxAge, 60)
    t.equal(response.cookies[1].domain, 'fastify.dev')

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

  fastify.inject({
    method: 'POST',
    url: '/delete',
    payload: {
      some: 'data'
    }
  }, (error, response) => {
    t.error(error)
    t.equal(response.statusCode, 200)
    t.ok(response.headers['set-cookie'])
    t.equal(response.cookies.length, 2)
    t.equal(response.cookies[0].name, 'longTermSession')
    t.equal(response.cookies[1].name, 'short-term-cookie')
    t.equal(response.cookies[1].maxAge, 0)
  })
})

tap.test('decorators should handle multiple sessions properly', async t => {
  const fastify = require('fastify')({
    logger: false
  })

  await fastify.register(require('../'), [{
    secret: 'top_secret aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    sessionName: 'longTermSession'
  }, {
    secret: 'VS-nfD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    cookieName: 'short-term-cookie',
    sessionName: 'shortTermSession'
  }])

  t.teardown(fastify.close.bind(fastify))
  t.plan(5)

  t.ok(fastify.encodeSecureSession(fastify.createSecureSession({}), 'shortTermSession'))

  const shortTermSession = fastify.createSecureSession({ foo: 'bar' })
  const longTermSession = fastify.createSecureSession({ bar: 'foo' })
  const shortTermSessionEncoded = fastify.encodeSecureSession(shortTermSession, 'shortTermSession')
  const longTermSessionEncoded = fastify.encodeSecureSession(longTermSession, 'longTermSession')

  t.ok(fastify.decodeSecureSession(longTermSessionEncoded, undefined, 'longTermSession'))
  t.equal(fastify.decodeSecureSession(longTermSessionEncoded, undefined, 'shortTermSession'), null)

  const decodedLongTermSession = fastify.decodeSecureSession(longTermSessionEncoded, undefined, 'longTermSession')
  t.equal(decodedLongTermSession.get('bar'), 'foo')

  const decodedShortTermSession = fastify.decodeSecureSession(shortTermSessionEncoded, undefined, 'shortTermSession')
  t.equal(decodedShortTermSession.get('foo'), 'bar')
})
