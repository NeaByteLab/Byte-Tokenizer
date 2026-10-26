import * as Assert from '@std/assert'
import Tokenizer from '@app/index.ts'

Deno.test('ByteTokenizer - assigns special token IDs from 256', () => {
  const tokenizer = new Tokenizer(['<|bos|>', '<|eos|>'])
  Assert.assertEquals(tokenizer.encode('<|bos|>Hello!<|eos|>'), [
    256,
    72,
    101,
    108,
    108,
    111,
    33,
    257
  ])
  Assert.assertEquals(tokenizer.decode([256, 72, 105, 257]), '<|bos|>Hi<|eos|>')
})

Deno.test('ByteTokenizer - decodes bytes and keeps a leading BOM', () => {
  const tokenizer = new Tokenizer()
  Assert.assertEquals(tokenizer.decode([]), '')
  Assert.assertEquals(tokenizer.decode([72, 105]), 'Hi')
  Assert.assertEquals(tokenizer.decode([0, 10, 9]), '\0\n\t')
  Assert.assertEquals(tokenizer.decode([239, 187, 191, 65]), '\uFEFFA')
  Assert.assertEquals(tokenizer.decode([255]), '\ufffd')
  Assert.assertEquals(tokenizer.decode(new Uint8Array([72, 105])), 'Hi')
})

Deno.test('ByteTokenizer - encodes raw bytes without special tokens', () => {
  const tokenizer = new Tokenizer()
  Assert.assertEquals(tokenizer.encode(''), [])
  Assert.assertEquals(tokenizer.encode('Hello!'), [72, 101, 108, 108, 111, 33])
  Assert.assertEquals(tokenizer.encode('A'), [65])
  Assert.assertEquals(tokenizer.encode('a'), [97])
  Assert.assertEquals(tokenizer.encode('\0\n\t'), [0, 10, 9])
  Assert.assertEquals(tokenizer.encode('🚀'), [240, 159, 154, 128])
})

Deno.test('ByteTokenizer - escapes regex characters in special tokens', () => {
  const tokenizer = new Tokenizer(['a+b', '(sep)', '[cls]', '$', 'a|b', '.*'])
  const text = 'a+b(sep)[cls]$a|b.*'
  Assert.assertEquals(tokenizer.decode(tokenizer.encode(text)), text)
})

Deno.test('ByteTokenizer - ignores duplicate special tokens', () => {
  const tokenizer = new Tokenizer(['<a>', '<b>', '<a>'])
  Assert.assertEquals(tokenizer.encode('<a><b><a>'), [256, 257, 256])
  Assert.assertThrows(() => tokenizer.decode([258]), RangeError)
})

Deno.test('ByteTokenizer - keeps case and unicode form distinct', () => {
  const tokenizer = new Tokenizer()
  Assert.assertEquals(tokenizer.encode('é'), [195, 169])
  Assert.assertNotEquals(tokenizer.encode('é'), tokenizer.encode('e\u0301'))
  Assert.assertEquals(tokenizer.decode(tokenizer.encode('e\u0301')), 'e\u0301')
  Assert.assertEquals(tokenizer.encode('\uFEFFA'), [239, 187, 191, 65])
})

Deno.test('ByteTokenizer - matches overlapping tokens left to right', () => {
  const tokenizer = new Tokenizer(['aa', 'a'])
  Assert.assertEquals(tokenizer.encode('aaa'), [256, 257])
  Assert.assertEquals(tokenizer.encode('aaaa'), [256, 256])
  Assert.assertEquals(tokenizer.decode(tokenizer.encode('aaa')), 'aaa')
})

Deno.test('ByteTokenizer - prefers the longest special token', () => {
  const tokenizer = new Tokenizer(['<|im|>', '<|im_start|>', '<|im_end|>', 'start'])
  Assert.assertEquals(tokenizer.encode('<|im_start|>start<|im|><|im_end|>'), [257, 259, 256, 258])
  Assert.assertEquals(tokenizer.decode([257, 259, 256, 258]), '<|im_start|>start<|im|><|im_end|>')
})

Deno.test('ByteTokenizer - rejects an invalid constructor argument', () => {
  Assert.assertThrows(() => new Tokenizer(null as unknown as string[]), TypeError)
  Assert.assertThrows(() => new Tokenizer('abc' as unknown as string[]), TypeError)
  Assert.assertThrows(() => new Tokenizer(['']), TypeError)
  Assert.assertThrows(() => new Tokenizer(['ok', 1 as unknown as string]), TypeError)
})

Deno.test('ByteTokenizer - round trips mixed unicode and special tokens', () => {
  const tokenizer = new Tokenizer(['<|bos|>', '🚀'])
  const text = 'á<|bos|>🚀'.repeat(20)
  Assert.assertEquals(tokenizer.decode(tokenizer.encode(text)), text)
  Assert.assertEquals(tokenizer.decode(new Uint16Array(tokenizer.encode('<|bos|>Hi'))), '<|bos|>Hi')
})

Deno.test('ByteTokenizer.decode - rejects a non-array-like value', () => {
  const tokenizer = new Tokenizer()
  Assert.assertThrows(() => tokenizer.decode(null as unknown as number[]), TypeError)
  Assert.assertThrows(() => tokenizer.decode('A' as unknown as number[]), TypeError)
  Assert.assertThrows(() => tokenizer.decode((() => {}) as unknown as number[]), TypeError)
})

Deno.test('ByteTokenizer.decode - rejects a non-integer ID', () => {
  const tokenizer = new Tokenizer()
  Assert.assertThrows(() => tokenizer.decode([65.5]), TypeError)
  Assert.assertThrows(() => tokenizer.decode([NaN]), TypeError)
  Assert.assertThrows(() => tokenizer.decode([Infinity]), TypeError)
  const holes = [65, 66]
  delete holes[0]
  Assert.assertThrows(() => tokenizer.decode(holes), TypeError)
})

Deno.test('ByteTokenizer.decode - rejects an ID outside the vocabulary', () => {
  const tokenizer = new Tokenizer(['<|bos|>'])
  Assert.assertThrows(() => tokenizer.decode([-1]), RangeError)
  Assert.assertThrows(() => tokenizer.decode([-0]), RangeError)
  Assert.assertThrows(() => tokenizer.decode([257]), RangeError)
  Assert.assertEquals(tokenizer.decode([0]), '\0')
  Assert.assertEquals(tokenizer.decode([256]), '<|bos|>')
})

Deno.test('ByteTokenizer.encode - rejects a non-string', () => {
  const tokenizer = new Tokenizer()
  Assert.assertThrows(() => tokenizer.encode(null as unknown as string), TypeError)
  Assert.assertThrows(() => tokenizer.encode(42 as unknown as string), TypeError)
})
