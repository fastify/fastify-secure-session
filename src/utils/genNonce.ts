import sodium from 'sodium-native';

export const genNonce = (): Buffer => {
  var buf = Buffer.allocUnsafe(sodium.crypto_secretbox_NONCEBYTES)
  sodium.randombytes_buf(buf)
  return buf
}
