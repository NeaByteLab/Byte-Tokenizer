<div align='center'>

# Byte Tokenizer

Encode text as UTF-8 bytes and special tokens

[![Deno](https://img.shields.io/badge/deno-compatible-ffcb00?logo=deno&logoColor=000000)](https://deno.com) [![Node](https://img.shields.io/badge/node-%3E%3D24-6DA55F?logo=node.js&logoColor=white)](https://nodejs.org) [![Bun](https://img.shields.io/badge/bun-compatible-f9f1e1?logo=bun&logoColor=000000)](https://bun.sh) [![Browser](https://img.shields.io/badge/browser-compatible-4285F4?logo=googlechrome&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/JavaScript) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

## What is Byte Tokenizer?

Byte Tokenizer turns text into token IDs and turns those IDs back into text. Ordinary characters become raw UTF-8 bytes from `0` to `255`, while optional special tokens start at `256` and match longest-first, so `<|im_start|>` is not split into a shorter `<|im|>` prefix. There is no vocabulary file, lowercase folding, or Unicode normalization, so case, combining marks, null bytes, and a leading BOM stay as encoded. Duplicate special tokens are ignored, and invalid UTF-8 bytes decode as `U+FFFD`.

## Installation

**Deno:**

```bash
deno add npm:@neabyte/byte-tokenizer
```

**npm:**

```bash
npm install @neabyte/byte-tokenizer
```

**CDN (jsDelivr/esm.sh):**

```html
<script type="module">
  import Tokenizer from 'https://cdn.jsdelivr.net/npm/@neabyte/byte-tokenizer/dist/index.mjs'
</script>
```

Or via [esm.sh](https://esm.sh):

```html
<script type="module">
  import Tokenizer from 'https://esm.sh/@neabyte/byte-tokenizer'
</script>
```

## Usage

```ts
import Tokenizer from '@neabyte/byte-tokenizer'

// Raw bytes from 0 to 255
const tokenizer = new Tokenizer()

const rawIds = tokenizer.encode('Hello!')
// [72, 101, 108, 108, 111, 33]

const rawText = tokenizer.decode(rawIds)
// 'Hello!'

// Special tokens start at 256
const customTokenizer = new Tokenizer(['<|bos|>', '<|eos|>'])

const customIds = customTokenizer.encode('<|bos|>Hello!<|eos|>')
// [256, 72, 101, 108, 108, 111, 33, 257]

const customText = customTokenizer.decode(customIds)
// '<|bos|>Hello!<|eos|>'
```

## API

### constructor

```js
new Tokenizer(specialToken?)
```

- `specialToken` `<string[]>`: (Optional) Special token strings. Defaults to `[]`. Empty strings are rejected. Duplicate strings keep the first ID. IDs start at `256` and follow first-seen order.
- Throws: `TypeError` when the argument is not an array, or a token is empty or not a string.

### encode

```js
tokenizer.encode(text)
```

- `text` `<string>`: Text to encode. Plain spans become UTF-8 byte IDs. A matching special token becomes one ID, and the longest match wins.
- Returns: `<number[]>`
- Throws: `TypeError` when `text` is not a string.

### decode

```js
tokenizer.decode(identifier)
```

- `identifier` `<ArrayLike<number>>`: Token IDs, including typed arrays. IDs `0` to `255` become bytes. IDs `256` and above expand to their special-token text. A leading BOM is kept.
- Returns: `<string>`
- Throws: `TypeError` when the value is not array-like, or an ID is not an integer.
- Throws: `RangeError` when an ID is negative, `-0`, or outside the vocabulary.

## Build

```bash
npm run build
```

## Testing

```bash
deno task check
```

```bash
deno task test
```

## License

This project is licensed under the [MIT License](./LICENSE).
