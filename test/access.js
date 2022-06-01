'use strict'

const t = require('tap')
const Fastify = require('fastify')
const sodium = require('sodium-native')
const SecureSessionPlugin = require('../')
const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(key)

t.test('Native getting and settings props and getter and setter method both work', t => {
  t.plan(5)
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data1', request.body)
    request.session.data2 = request.body

    reply.send('hello world')
  })

  t.teardown(fastify.close.bind(fastify))

  fastify.get('/', (request, reply) => {
    const data1 = request.session.get('data1')
    const data2 = request.session.data1

    const data3 = request.session.data2
    const data4 = request.session.get('data2')

    if (!data1 || !data2 || !data3 || !data4) {
      reply.code(404).send()
      return
    }
    reply.send({ data1, data2, data3, data4 })
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

    fastify.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: response.headers['set-cookie']
      }
    }, (error, response) => {
      t.error(error)
      t.same(JSON.parse(response.payload), {
        data1: { some: 'data' },
        data2: { some: 'data' },
        data3: { some: 'data' },
        data4: { some: 'data' }
      })
    })
  })
})

t.test('Get all data that we set in session', t => {
  t.plan(5)
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data1', request.body)
    request.session.data2 = request.body

    reply.send('hello world')
  })

  t.teardown(fastify.close.bind(fastify))

  fastify.get('/', (request, reply) => {
    const data = request.session.data()

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

    fastify.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: response.headers['set-cookie']
      }
    }, (error, response) => {
      t.error(error)
      t.same(JSON.parse(response.payload), {
        data1: { some: 'data' },
        data2: { some: 'data' }
      })
    })
  })
})

t.test('session is changed', t => {
  t.plan(7)
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data1', request.body)
    request.session.data2 = request.body

    const changed = request.session.changed

    if (!changed) {
      reply.code(404).send()
      return
    }

    reply.send(changed)
  })

  t.teardown(fastify.close.bind(fastify))

  fastify.get('/', (request, reply) => {
    const changed = request.session.changed

    if (changed) { // changed should be false, as session has not been changed here
      reply.code(500).send()
      return
    }

    reply.send(changed)
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
    t.same(JSON.parse(response.payload), true)

    fastify.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: response.headers['set-cookie']
      }
    }, (error, response) => {
      t.error(error)
      t.notOk(response.headers['set-cookie']) // new cookie should not be issued, since session is unchanged
      t.same(JSON.parse(response.payload), false)
    })
  })
})

t.test('session is deleted', t => {
  t.plan(5)
  const fastify = Fastify()
  fastify.register(SecureSessionPlugin, {
    key
  })

  fastify.post('/', (request, reply) => {
    request.session.set('data1', request.body)
    request.session.data2 = request.body

    reply.send('hello world')
  })

  fastify.post('/delete', (request, reply) => {
    request.session.delete()
    const deleted = request.session.deleted

    reply.send(deleted)
  })

  t.teardown(fastify.close.bind(fastify))

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

    fastify.inject({
      method: 'POST',
      url: '/delete',
      headers: {
        cookie: response.headers['set-cookie']
      }
    }, (error, response) => {
      t.error(error)
      t.same(JSON.parse(response.payload), true)
    })
  })
})
