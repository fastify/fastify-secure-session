'use strict'

const fp = require('fastify-plugin')
const sodium = require('sodium-native')
const kObj = Symbol('object')

module.exports = fp(function (fastify, options, next) {
  var key
  if (options.secret) {
    if (Buffer.byteLength(options.secret) < 32) {
      return next(new Error('secret must be at least 32 bytes'))
    }

    key = Buffer.allocUnsafe(sodium.crypto_secretbox_KEYBYTES)

    // static salt to be used for key derivation, not great for security,
    // but better than nothing
    var salt = Buffer.from('mq9hDxBVDbspDR6nLfFT1g==', 'base64')

    if (options.salt) {
      salt = (Buffer.isBuffer(options.salt)) ? options.salt : Buffer.from(options.salt, 'ascii')
    }

    if (Buffer.byteLength(salt) !== sodium.crypto_pwhash_SALTBYTES) {
      return next(new Error('salt must be length ' + sodium.crypto_pwhash_SALTBYTES))
    }

    sodium.crypto_pwhash(key,
      Buffer.from(options.secret),
      salt,
      sodium.crypto_pwhash_OPSLIMIT_MODERATE,
      sodium.crypto_pwhash_MEMLIMIT_MODERATE,
      sodium.crypto_pwhash_ALG_DEFAULT)
  }

  if (options.key) {
    key = options.key
    if (typeof key === 'string') {
      key = Buffer.from(key, 'base64')
    } else if (!(key instanceof Buffer)) {
      return next(new Error('key must be a string or a Buffer'))
    }

    if (key.length < sodium.crypto_secretbox_KEYBYTES) {
      return next(new Error(`key must be at least ${sodium.crypto_secretbox_KEYBYTES} bytes`))
    }
  }

  if (!key) {
    return next(new Error('key or secret must specified'))
  }

  const cookieName = options.cookieName || 'session'
  const cookieOptions = options.cookieOptions || options.cookie || {}

  // just to add something to the shape
  // TODO verify if it helps the perf
  fastify.decorateRequest('session', null)

  fastify
    .register(require('fastify-cookie'))
    .register(fp(addHooks))

  next()

  function addHooks (fastify, options, next) {
    // the hooks must be registered after fastify-cookie hooks

    fastify.addHook('onRequest', function decodeSession (request, reply, next) {
      const cookie = request.cookies[cookieName]
      if (cookie === undefined) {
        // there is no cookie
        request.session = new Session({})
        next()
        return
      }

      // do not use destructuring or it will deopt
      const split = cookie.split(';')
      const cyphertextB64 = split[0]
      const nonceB64 = split[1]

      if (split.length <= 1) {
        // the cookie is malformed
        request.session = new Session({})
        next()
        return
      }

      const cipher = Buffer.from(cyphertextB64, 'base64')
      const nonce = Buffer.from(nonceB64, 'base64')

      if (cipher.length < sodium.crypto_secretbox_MACBYTES) {
        // not long enough
        request.session = new Session({})
        next()
        return
      }

      const msg = Buffer.allocUnsafe(cipher.length - sodium.crypto_secretbox_MACBYTES)
      if (!sodium.crypto_secretbox_open_easy(msg, cipher, nonce, key)) {
        // unable to decrypt
        request.session = new Session({})
        next()
        return
      }

      request.session = new Session(JSON.parse(msg))
      next()
    })

    fastify.addHook('onSend', function encodeSession (request, reply, payload, next) {
      const session = request.session

      if (!session || !session.changed) {
        // nothing to do
        next()
        return
      } else if (session.deleted) {
        const tmpCookieOptions = Object.assign({}, cookieOptions, { expires: new Date(0), maxAge: 0 })
        reply.setCookie(cookieName, '', tmpCookieOptions)
        next()
        return
      }

      const nonce = genNonce()
      const msg = Buffer.from(JSON.stringify(session[kObj]))

      const cipher = Buffer.allocUnsafe(msg.length + sodium.crypto_secretbox_MACBYTES)
      sodium.crypto_secretbox_easy(cipher, msg, nonce, key)

      reply.setCookie(cookieName, cipher.toString('base64') + ';' + nonce.toString('base64'), cookieOptions)
      next()
    })

    next()
  }
}, '>= 0.35.0')

class Session {
  constructor (obj) {
    this[kObj] = obj
    this.changed = false
    this.deleted = false
  }

  get (key) {
    return this[kObj][key]
  }

  set (key, value) {
    this.changed = true
    this[kObj][key] = value
  }

  delete () {
    this.changed = true
    this.deleted = true
  }
}

function genNonce () {
  var buf = Buffer.allocUnsafe(sodium.crypto_secretbox_NONCEBYTES)
  sodium.randombytes_buf(buf)
  return buf
}
