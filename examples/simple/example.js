'use strict'

const fastify = require('fastify')({ logger: false })
const fs = require('fs')
const path = require('path')
const assert = require('assert')

fastify.register(require('../..'), {
  key: fs.readFileSync(path.join(__dirname, 'example-key'))
})

fastify.post('/', (request, reply) => {
  request.session.set('data', request.body)
  reply.send('hello world')
})

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
  if (error) throw error

  fastify.inject({
    method: 'GET',
    url: '/',
    headers: {
      cookie: response.headers['set-cookie']
    }
  }, (error, response) => {
    if (error) throw error

    assert.deepStrictEqual(JSON.parse(response.payload), { some: 'data' })
  })
})
