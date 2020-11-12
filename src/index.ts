import fastifyPlugin from 'fastify-plugin'
import { plugin } from './plugin'

export default fastifyPlugin(plugin, {
  fastify: '3.x',
  name: 'fastify-secure-session',
})
