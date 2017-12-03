'use strict'

const fastify = require('fastify')({ logger: false })

fastify.register(require('./'), {
  secret: 'averylogphrasebiggerthanthirtytwochars'
})

fastify.post('/', (request, reply) => {
  request.session.set('data', request.body)
  reply.send('session set')
})

fastify.get('/', (request, reply) => {
  const data = request.session.get('data')
  if (!data) {
    reply.code(404).send()
    return
  }
  reply.send(data)
})

fastify.listen(3000)
