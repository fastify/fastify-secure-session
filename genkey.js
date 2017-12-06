#! /usr/bin/env node

'use strict'

const sodium = require('sodium-universal')
const buf = Buffer.allocUnsafe(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(buf)
process.stdout.write(buf)
