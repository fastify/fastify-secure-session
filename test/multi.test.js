'use strict'

const { test } = require('node:test')

test('it should handle multiple sessions properly', async t => {
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

  t.after(() => fastify.close())

  fastify.get('/', (request, reply) => {
    const data = request.longTermSession.get('data')
    if (!data) {
      reply.code(404).send()
      return
    }
    reply.send(data)
  })

  const postResponse = await fastify.inject({
    method: 'POST',
    url: '/',
    payload: {
      some: 'data'
    }
  })

  t.assert.ok(postResponse)
  t.assert.strictEqual(postResponse.statusCode, 200)
  t.assert.ok(postResponse.headers['set-cookie'])
  t.assert.strictEqual(postResponse.cookies.length, 2)
  t.assert.strictEqual(postResponse.cookies[0].name, 'longTermSession')
  t.assert.strictEqual(postResponse.cookies[0].maxAge, 3600)
  t.assert.strictEqual(postResponse.cookies[0].domain, undefined)

  t.assert.strictEqual(postResponse.cookies[1].name, 'short-term-cookie')
  t.assert.strictEqual(postResponse.cookies[1].maxAge, 60)
  t.assert.strictEqual(postResponse.cookies[1].domain, 'fastify.dev')

  const getResponse = await fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: postResponse.headers['set-cookie']
    }
  })
  t.assert.ok(getResponse)
  t.assert.deepStrictEqual(JSON.parse(getResponse.payload), { some: 'data' })

  const deleteResponse = await fastify.inject({
    method: 'POST',
    url: '/delete',
    payload: {
      some: 'data'
    }
  })
  t.assert.ok(deleteResponse)
  t.assert.strictEqual(deleteResponse.statusCode, 200)
  t.assert.ok(deleteResponse.headers['set-cookie'])
  t.assert.strictEqual(deleteResponse.cookies.length, 2)
  t.assert.strictEqual(deleteResponse.cookies[0].name, 'longTermSession')
  t.assert.strictEqual(deleteResponse.cookies[1].name, 'short-term-cookie')
  t.assert.strictEqual(deleteResponse.cookies[1].maxAge, 0)
})

test('decorators should handle multiple sessions properly', async t => {
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

  t.after(() => fastify.close())

  t.assert.ok(fastify.encodeSecureSession(fastify.createSecureSession({}), 'shortTermSession'))

  const shortTermSession = fastify.createSecureSession({ foo: 'bar' })
  const longTermSession = fastify.createSecureSession({ bar: 'foo' })
  const shortTermSessionEncoded = fastify.encodeSecureSession(shortTermSession, 'shortTermSession')
  const longTermSessionEncoded = fastify.encodeSecureSession(longTermSession, 'longTermSession')

  t.assert.ok(fastify.decodeSecureSession(longTermSessionEncoded, undefined, 'longTermSession'))
  t.assert.strictEqual(fastify.decodeSecureSession(longTermSessionEncoded, undefined, 'shortTermSession'), null)

  const decodedLongTermSession = fastify.decodeSecureSession(longTermSessionEncoded, undefined, 'longTermSession')
  t.assert.strictEqual(decodedLongTermSession.get('bar'), 'foo')

  const decodedShortTermSession = fastify.decodeSecureSession(shortTermSessionEncoded, undefined, 'shortTermSession')
  t.assert.strictEqual(decodedShortTermSession.get('foo'), 'bar')
})
