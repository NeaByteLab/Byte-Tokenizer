import * as Assert from '@std/assert'
import Tokenizer from '@app/index.ts'

Deno.test('ByteTokenizer - assigns special token IDs after chunks', () => {
  const tokenizer = new Tokenizer(['<|bos|>', '<|eos|>'])
  Assert.assertEquals(tokenizer.encode('<|bos|>Hello!<|eos|>'), [
    65793,
    18790,
    28013,
    112,
    34,
    65794
  ])
  Assert.assertEquals(tokenizer.decode([65793, 18794, 65794]), '<|bos|>Hi<|eos|>')
})

Deno.test('ByteTokenizer - decodes chunks and keeps a leading BOM', () => {
  const tokenizer = new Tokenizer()
  Assert.assertEquals(tokenizer.decode([]), '')
  Assert.assertEquals(tokenizer.decode([18794]), 'Hi')
  Assert.assertEquals(tokenizer.decode([267, 10]), '\0\n\t')
  Assert.assertEquals(tokenizer.decode([61628, 49218]), '\uFEFFA')
  Assert.assertEquals(tokenizer.decode([255]), '\ufffd')
  Assert.assertEquals(tokenizer.decode(new Uint16Array([18794])), 'Hi')
})

Deno.test('ByteTokenizer - encodes subword chunks without special tokens', () => {
  const tokenizer = new Tokenizer()
  Assert.assertEquals(tokenizer.encode(''), [])
  Assert.assertEquals(tokenizer.encode('Hello!'), [18790, 28013, 112, 34])
  Assert.assertEquals(tokenizer.encode('A'), [66])
  Assert.assertEquals(tokenizer.encode('a'), [98])
  Assert.assertEquals(tokenizer.encode('\0\n\t'), [267, 10])
  Assert.assertEquals(tokenizer.encode('🚀'), [61856, 39809])
})

Deno.test('ByteTokenizer - handles regex characters in special tokens', () => {
  const tokenizer = new Tokenizer(['a+b', '(sep)', '[cls]', '$', 'a|b', '.*'])
  const text = 'a+b(sep)[cls]$a|b.*'
  Assert.assertEquals(tokenizer.decode(tokenizer.encode(text)), text)
})

Deno.test('ByteTokenizer - ignores duplicate special tokens', () => {
  const tokenizer = new Tokenizer(['<a>', '<b>', '<a>'])
  Assert.assertEquals(tokenizer.encode('<a><b><a>'), [65793, 65794, 65793])
  Assert.assertThrows(() => tokenizer.decode([65795]), RangeError)
})

Deno.test('ByteTokenizer - keeps case and unicode form distinct', () => {
  const tokenizer = new Tokenizer()
  Assert.assertEquals(tokenizer.encode('é'), [50346])
  Assert.assertNotEquals(tokenizer.encode('é'), tokenizer.encode('e\u0301'))
  Assert.assertEquals(tokenizer.decode(tokenizer.encode('e\u0301')), 'e\u0301')
  Assert.assertEquals(tokenizer.encode('\uFEFFA'), [61628, 49218])
})

Deno.test('ByteTokenizer - matches overlapping tokens left to right', () => {
  const tokenizer = new Tokenizer(['aa', 'a'])
  Assert.assertEquals(tokenizer.encode('aaa'), [65793, 65794])
  Assert.assertEquals(tokenizer.encode('aaaa'), [65793, 65793])
  Assert.assertEquals(tokenizer.decode(tokenizer.encode('aaa')), 'aaa')
})

Deno.test('ByteTokenizer - prefers the longest special token', () => {
  const tokenizer = new Tokenizer(['<|im|>', '<|im_start|>', '<|im_end|>', 'start'])
  Assert.assertEquals(tokenizer.encode('<|im_start|>start<|im|><|im_end|>'), [
    65794,
    65796,
    65793,
    65795
  ])
  Assert.assertEquals(
    tokenizer.decode([65794, 65796, 65793, 65795]),
    '<|im_start|>start<|im|><|im_end|>'
  )
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
  Assert.assertEquals(tokenizer.decode(tokenizer.encode('<|bos|>Hi')), '<|bos|>Hi')
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
  Assert.assertThrows(() => tokenizer.decode([0]), RangeError)
  Assert.assertThrows(() => tokenizer.decode([65794]), RangeError)
  Assert.assertEquals(tokenizer.decode([1]), '\0')
  Assert.assertEquals(tokenizer.decode([65793]), '<|bos|>')
})

Deno.test('ByteTokenizer.encode - rejects a non-string', () => {
  const tokenizer = new Tokenizer()
  Assert.assertThrows(() => tokenizer.encode(null as unknown as string), TypeError)
  Assert.assertThrows(() => tokenizer.encode(42 as unknown as string), TypeError)
})
