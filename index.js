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
    } else if (key instanceof Array) {
      key = key.map(ensureBufferKey)
    } else if (!(key instanceof Buffer)) {
      return next(new Error('key must be a string or a Buffer'))
    }

    if (!(key instanceof Array) && key.length < sodium.crypto_secretbox_KEYBYTES) {
      return next(new Error(`key must be at least ${sodium.crypto_secretbox_KEYBYTES} bytes`))
    } else if (key instanceof Array && key.some(k => k < sodium.crypto_secretbox_KEYBYTES)) {
      return next(new Error(`key lengths must be at least ${sodium.crypto_secretbox_KEYBYTES} bytes`))
    }
  }

  if (!key) {
    return next(new Error('key or secret must specified'))
  }

  if (!(key instanceof Array)) {
    key = [key]
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

      let signingKeyRotated = false
      const decodeSuccess = key.some((k, i) => {
        const decoded = sodium.crypto_secretbox_open_easy(msg, cipher, nonce, k)

        signingKeyRotated = decoded && i > 0

        return decoded
      })

      if (!decodeSuccess) {
        // unable to decrypt
        request.session = new Session({})
        next()
        return
      }

      request.session = new Session(JSON.parse(msg))

      if (signingKeyRotated) {
        request.session.changed = true
      }

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
      sodium.crypto_secretbox_easy(cipher, msg, nonce, key[0])

      reply.setCookie(cookieName, cipher.toString('base64') + ';' + nonce.toString('base64'), cookieOptions)
      next()
    })

    next()
  }
}, {
  fastify: '3.x',
  name: 'fastify-secure-session'
})

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

function ensureBufferKey (k) {
  if (k instanceof Buffer) {
    return k
  }

  if (typeof k !== 'string') {
    throw new Error('Key must be string or buffer')
  }

  return Buffer.from(k, 'base64')
}
