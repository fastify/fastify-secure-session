#! /usr/bin/env node

'use strict'

const argv = require('minimist')(process.argv.slice(2))

if (argv.h) {
  console.log(`
  fastify-secure-session-generate-key

  -h        this help page
  -l        the length of the secret, default 32
  -e        an optional encoding, default 'utf8'
`)
} else {
  const length = argv.l || 32
  const encoding = argv.e || 'utf8'

  process.stdout.write(require('crypto').randomBytes(length).toString(encoding))
}
