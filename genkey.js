#! /usr/bin/env node

'use strict'

const argv = require('minimist')(process.argv.slice(2))

if (argv.h) {
  console.log(`
  @fastify/secure-session key generator

  -h        this help page
  -l        the length of the secret in bytes, default 32
  -e        the encoding of the output, default 'utf8'
`)
} else {
  const length = argv.l || 32
  const encoding = argv.e || 'utf8'

  if (length < 32) {
    process.stderr.write('secret must be at least 32 bytes\n')
    process.exit(1)
  }

  process.stdout.write(require('crypto').randomBytes(length).toString(encoding))
}
