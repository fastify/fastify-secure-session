import type { FastifyPluginAsync } from 'fastify'
import fastifyCookie, { CookieSerializeOptions } from 'fastify-cookie'
import fastifyPlugin from 'fastify-plugin'
import { addDecorators } from './decorators'
import { addHooks } from './hooks'
import { asBuffer, buildKeyFromSecretAndSalt, sanitizeSecretKeys } from './utils'

export type SecretKey = Buffer | string | (Buffer | string)[]

export type SecureSessionPluginOptions = {
  salt: Buffer | string
  secret: Buffer | string
  key: SecretKey
  cookieName?: string
  cookie?: CookieSerializeOptions
  cookieOptions?: CookieSerializeOptions
}

export const plugin: FastifyPluginAsync<SecureSessionPluginOptions> = async (fastify, options): Promise<void> => {
  const { key, secret, salt, cookieName = 'session' } = options

  if (!key && !secret) {
    throw new Error('key or secret must specified')
  }

  const secretKeys: Buffer[] = secret
    ? [buildKeyFromSecretAndSalt(asBuffer(secret), salt ? asBuffer(salt) : undefined)]
    : sanitizeSecretKeys(key)

  fastify.register(fastifyPlugin(addDecorators), { secretKeys })

  fastify.register(fastifyCookie)

  const cookieOptions = options.cookieOptions || options.cookie || {}
  fastify.register(fastifyPlugin(addHooks), { cookieName, cookieOptions })
}
