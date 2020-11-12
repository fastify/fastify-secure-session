#! /usr/bin/env node

'use strict'

const sodium = require('sodium-native')
const buf = Buffer.allocUnsafe(sodium.crypto_secretbox_KEYBYTES)
sodium.randombytes_buf(buf)
process.stdout.write(buf)
