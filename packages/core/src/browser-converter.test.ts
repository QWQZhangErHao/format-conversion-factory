/**
 * Comprehensive tests for browser-converter.ts.
 *
 * Covers every converter function, edge cases, empty inputs, special characters,
 * error handling, and the main dispatch API.
 *
 * All converter functions are tested indirectly via convertInBrowser(),
 * which is the documented public entry point.
 */

import { describe, it, expect } from 'vitest'
import {
  getConverterId,
  isBrowserConvertible,
  convertInBrowser,
  getOutputExtension,
} from './browser-converter'

// ── csvToJson ──

describe('csvToJson', () => {
  const convert = (csv: string) => convertInBrowser(csv, 'csv', 'json')

  it('converts a normal CSV string with multiple rows', () => {
    const csv = 'name,age,city\nAlice,30,New York\nBob,25,Los Angeles'
    const result = JSON.parse(convert(csv))
    expect(result).toEqual([
      { name: 'Alice', age: '30', city: 'New York' },
      { name: 'Bob', age: '25', city: 'Los Angeles' },
    ])
  })

  it('returns an empty array for CSV with only headers (no data rows)', () => {
    expect(convert('a,b,c')).toBe('[]')
  })

  it('returns an empty array for an empty string', () => {
    expect(convert('')).toBe('[]')
  })

  it('returns an empty array for a single line with no headers', () => {
    expect(convert('single')).toBe('[]')
  })

  it('handles quoted values (no special parsing — just trims)', () => {
    const csv = 'a,b\n"hello","world"'
    const result = JSON.parse(convert(csv))
    // The converter does not strip quotes, so they remain in the value
    expect(result).toEqual([{ a: '"hello"', b: '"world"' }])
  })

  it('handles trailing whitespace in lines', () => {
    const csv = 'x,y\n  1,2  \n  3,4  '
    const result = JSON.parse(convert(csv))
    expect(result).toEqual([
      { x: '1', y: '2' },
      { x: '3', y: '4' },
    ])
  })

  it('fills missing trailing values with empty string', () => {
    const csv = 'a,b,c\n1,2'
    const result = JSON.parse(convert(csv))
    expect(result).toEqual([{ a: '1', b: '2', c: '' }])
  })

  it('handles a single data row', () => {
    const csv = 'k,v\nonly,row'
    const result = JSON.parse(convert(csv))
    expect(result).toEqual([{ k: 'only', v: 'row' }])
  })

  it('trims whitespace from headers', () => {
    const csv = '  a  ,  b  \n1,2'
    const result = JSON.parse(convert(csv))
    expect(result).toEqual([{ a: '1', b: '2' }])
  })

  it('handles numeric values as strings (CSV is untyped)', () => {
    const csv = 'n\n42\n3.14\n-1'
    const result = JSON.parse(convert(csv))
    expect(result).toEqual([{ n: '42' }, { n: '3.14' }, { n: '-1' }])
  })

  it('handles multiple rows with differing whitespace', () => {
    const csv = 'a,b\n  x , y \n  p , q '
    const result = JSON.parse(convert(csv))
    expect(result).toEqual([
      { a: 'x', b: 'y' },
      { a: 'p', b: 'q' },
    ])
  })

  it('handles empty cell in the middle of a row', () => {
    const csv = 'a,b,c\n1,,3'
    const result = JSON.parse(convert(csv))
    expect(result).toEqual([{ a: '1', b: '', c: '3' }])
  })
})

// ── jsonToCsv ──

describe('jsonToCsv', () => {
  const convert = (json: string) => convertInBrowser(json, 'json', 'csv')

  it('converts an array of objects to CSV string', () => {
    const result = convert('[{"a":1,"b":2},{"a":3,"b":4}]')
    expect(result).toBe('a,b\n1,2\n3,4')
  })

  it('returns an empty string for an empty array', () => {
    expect(convert('[]')).toBe('')
  })

  it('wraps a single object in an array and converts it', () => {
    const result = convert('{"x":"hello","y":"world"}')
    expect(result).toBe('x,y\nhello,world')
  })

  it('collects all unique keys across objects', () => {
    const result = convert('[{"a":1},{"b":2},{"a":3,"c":4}]')
    const headerLine = result.split('\n')[0]!
    expect(headerLine.split(',').sort()).toEqual(['a', 'b', 'c'])
  })

  it('fills missing keys with an empty string', () => {
    const result = convert('[{"a":1,"b":2},{"a":3}]')
    expect(result).toBe('a,b\n1,2\n3,')
  })

  it('converts nested objects via String() coercion', () => {
    const result = convert('[{"name":"Alice","meta":{"role":"admin"}}]')
    expect(result).toContain('[object Object]')
  })

  it('converts arrays via String() coercion', () => {
    const result = convert('[{"id":1,"tags":["a","b"]}]')
    // CSV output will have tags rendered as "a,b"
    expect(result).toContain('a,b')
  })

  it('converts boolean and null values', () => {
    const result = convert('[{"active":true,"data":null}]')
    // null coalescing in the converter: null ?? '' → '', so null becomes empty string
    expect(result).toBe('active,data\ntrue,')
  })

  it('converts numeric zero correctly', () => {
    const result = convert('[{"value":0}]')
    expect(result).toBe('value\n0')
  })
})

// ── jsonToYaml ──

describe('jsonToYaml', () => {
  const convert = (json: string) => convertInBrowser(json, 'json', 'yaml')

  it('converts a simple flat object', () => {
    const result = convert('{"name":"Alice","age":30}')
    expect(result).toBe('name: Alice\nage: 30\n')
  })

  it('converts nested objects (value on same line via trimStart)', () => {
    const result = convert('{"person":{"name":"Bob","active":true}}')
    // The toYaml internal uses trimStart(), so nested values appear on the same
    // line as the parent key rather than on a new indented line
    expect(result).toContain('person: name: Bob')
    expect(result).toContain('active: true')
  })

  it('converts arrays', () => {
    const result = convert('{"items":[1,2,3]}')
    expect(result).toContain('items: - 1')
    expect(result).toContain('- 2')
    expect(result).toContain('- 3')
  })

  it('converts arrays of objects', () => {
    const result = convert('{"users":[{"id":1},{"id":2}]}')
    expect(result).toContain('users: - id: 1')
    expect(result).toContain('- id: 2')
  })

  it('handles null value', () => {
    const result = convert('{"value":null}')
    expect(result).toBe('value: null\n')
  })

  it('handles boolean values', () => {
    const result = convert('{"yes":true,"no":false}')
    expect(result).toBe('yes: true\nno: false\n')
  })

  it('handles integer and float numbers', () => {
    const result = convert('{"int":42,"float":3.14,"neg":-1}')
    expect(result).toBe('int: 42\nfloat: 3.14\nneg: -1\n')
  })

  it('quotes strings containing colons to avoid YAML ambiguity', () => {
    const result = convert('{"text":"key: value"}')
    expect(result).toContain('"key: value"')
  })

  it('quotes strings containing hashes', () => {
    const result = convert('{"note":"#comment"}')
    expect(result).toContain('"#comment"')
  })

  it('quotes strings containing single quotes', () => {
    const result = convert(JSON.stringify({ quote: "it's" }))
    expect(result).toContain('"it\'s"')
  })

  it('quotes an empty string value', () => {
    const result = convert('{"empty":""}')
    expect(result).toBe('empty: ""\n')
  })

  it('handles an empty object (output on same line)', () => {
    const result = convert('{"meta":{}}')
    // trimStart() pulls the {} up to the same line as the key
    expect(result).toBe('meta: {}\n')
  })

  it('handles an empty array (output on same line)', () => {
    const result = convert('{"items":[]}')
    expect(result).toBe('items: []\n')
  })

  it('handles deeply nested objects (all on same line)', () => {
    const result = convert('{"a":{"b":{"c":"deep"}}}')
    expect(result).toBe('a: b: c: deep\n')
  })

  it('handles deeply nested arrays', () => {
    const result = convert('{"matrix":[[1,2],[3,4]]}')
    expect(result).toContain('matrix: - - 1')
    expect(result).toContain('- 2')
    expect(result).toContain('- - 3')
    expect(result).toContain('- 4')
  })
})

// ── yamlToJson ──

describe('yamlToJson', () => {
  const convert = (yaml: string) => convertInBrowser(yaml, 'yaml', 'json')

  it('converts simple key:value pairs', () => {
    const result = JSON.parse(convert('name: Alice\nage: 30'))
    expect(result).toEqual({ name: 'Alice', age: 30 })
  })

  it('does not support nested objects (currentKey tracking is broken: children end up at root)', () => {
    const yaml = 'person:\n  name: Bob\n  active: true'
    const result = JSON.parse(convert(yaml))
    // person gets an empty object, children leak to the root level
    expect(result.person).toEqual({})
    expect(result.name).toBe('Bob')
    expect(result.active).toBe(true)
  })

  it('converts array items with - prefix', () => {
    const yaml = 'items:\n  - one\n  - two\n  - three'
    const result = JSON.parse(convert(yaml))
    expect(result).toEqual({ items: ['one', 'two', 'three'] })
  })

  it('skips comment lines starting with #', () => {
    const yaml = '# this is a comment\nkey: value\n# another comment'
    const result = JSON.parse(convert(yaml))
    expect(result).toEqual({ key: 'value' })
  })

  it('handles null value', () => {
    const result = JSON.parse(convert('key: null'))
    expect(result).toEqual({ key: null })
  })

  it('handles tilde null (~)', () => {
    const result = JSON.parse(convert('key: ~'))
    expect(result).toEqual({ key: null })
  })

  it('handles true / false booleans', () => {
    const result = JSON.parse(convert('yes: true\nno: false'))
    expect(result).toEqual({ yes: true, no: false })
  })

  it('parses positive integer numbers', () => {
    const result = JSON.parse(convert('count: 42'))
    expect(result).toEqual({ count: 42 })
  })

  it('leaves negative integers as strings (regex /^\d+$/ does not match "-")', () => {
    const result = JSON.parse(convert('neg: -1'))
    expect(result).toEqual({ neg: '-1' })
  })

  it('parses positive float numbers', () => {
    const result = JSON.parse(convert('pi: 3.14'))
    expect(result).toEqual({ pi: 3.14 })
  })

  it('leaves negative floats as strings (regex /^\d+\.\d+$/ does not match "-")', () => {
    const result = JSON.parse(convert('temp: -0.5'))
    expect(result).toEqual({ temp: '-0.5' })
  })

  it('strips double and single quotes from values', () => {
    const result = JSON.parse(convert('text: "hello"\ntitle: \'world\''))
    expect(result).toEqual({ text: 'hello', title: 'world' })
  })

  it('skips empty lines', () => {
    const result = JSON.parse(convert('\n\nkey: val\n\n'))
    expect(result).toEqual({ key: 'val' })
  })

  it('handles pipe markers as nested object start (children without colon are skipped)', () => {
    const yaml = 'desc: |\n  multi\n  line'
    const result = JSON.parse(convert(yaml))
    // desc gets an empty object; "multi" and "line" have no colon so they are skipped
    expect(result.desc).toEqual({})
    expect(result.multi).toBeUndefined()
  })

  it('skips lines without a colon separator', () => {
    const yaml = 'key: value\njust some text\nanother: val'
    const result = JSON.parse(convert(yaml))
    expect(result).toEqual({ key: 'value', another: 'val' })
  })

  it('stores root-level - items under an empty-string key', () => {
    const result = JSON.parse(convert('- a\n- b'))
    expect(result['']).toEqual(['a', 'b'])
  })
})

// ── jsonToToml ──

describe('jsonToToml', () => {
  const convert = (json: string) => convertInBrowser(json, 'json', 'toml')

  it('converts simple string, number, and boolean values', () => {
    const result = convert('{"name":"Alice","age":30,"active":true}')
    expect(result).toContain('name = "Alice"')
    expect(result).toContain('age = 30')
    expect(result).toContain('active = true')
  })

  it('converts nested objects as TOML sections', () => {
    const result = convert('{"server":{"host":"localhost","port":8080}}')
    expect(result).toContain('[server]')
    expect(result).toContain('host = "localhost"')
    expect(result).toContain('port = 8080')
  })

  it('converts arrays using JSON representation', () => {
    const result = convert('{"ids":[1,2,3]}')
    expect(result).toContain('ids = [1,2,3]')
  })

  it('handles null value output as string "null"', () => {
    const result = convert('{"value":null}')
    expect(result).toBe('value = "null"\n')
  })

  it('handles deeply nested objects with section nesting', () => {
    const result = convert('{"a":{"b":{"c":"deep"}}}')
    expect(result).toContain('[a.b]')
    expect(result).toContain('c = "deep"')
  })

  it('escapes double quotes inside string values', () => {
    const result = convert('{"msg":"he said \\\"hello\\\""}')
    expect(result).toContain('"he said \\"hello\\""')
  })

  it('handles boolean false', () => {
    const result = convert('{"flag":false}')
    expect(result).toContain('flag = false')
  })

  it('handles float numbers', () => {
    const result = convert('{"pi":3.14}')
    expect(result).toContain('pi = 3.14')
  })
})

// ── jsonToXml ──

describe('jsonToXml', () => {
  const convert = (json: string) => convertInBrowser(json, 'json', 'xml')

  it('produces an XML declaration at the top', () => {
    const result = convert('{}')
    expect(result).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/)
  })

  it('converts a simple object to XML elements', () => {
    const result = convert('{"name":"Alice","age":30}')
    expect(result).toContain('<name>Alice</name>')
    expect(result).toContain('<age>30</age>')
  })

  it('converts nested objects', () => {
    const result = convert('{"person":{"name":"Bob"}}')
    expect(result).toContain('<person>')
    expect(result).toContain('<name>Bob</name>')
    expect(result).toContain('</person>')
  })

  it('handles arrays by repeating the same tag for each element', () => {
    const result = convert('{"item":[1,2,3]}')
    expect(result).toContain('<item>1</item>')
    expect(result).toContain('<item>2</item>')
    expect(result).toContain('<item>3</item>')
  })

  it('handles null values with a null attribute', () => {
    const result = convert('{"data":null}')
    expect(result).toContain('<data null="true"/>')
  })

  it('handles boolean values', () => {
    const result = convert('{"active":true,"done":false}')
    expect(result).toContain('<active>true</active>')
    expect(result).toContain('<done>false</done>')
  })

  it('escapes &, <, and > in string values', () => {
    const result = convert('{"text":"a & b < c > d"}')
    expect(result).toContain('<text>a &amp; b &lt; c &gt; d</text>')
  })

  it('produces a self-closing tag for an empty object', () => {
    const result = convert('{"empty":{}}')
    expect(result).toContain('<empty/>')
  })

  it('omits the tag when the value is an empty array', () => {
    const result = convert('{"items":[]}')
    // The inner loop produces no output for an empty array
    expect(result).not.toContain('<items>')
  })
})

// ── markdownToHtml ──

describe('markdownToHtml', () => {
  const convert = (md: string) => convertInBrowser(md, 'markdown', 'html')

  it('wraps the entire output in a full HTML document', () => {
    const result = convert('hello')
    expect(result).toMatch(/^<!DOCTYPE html>/)
    expect(result).toContain('<html>')
    expect(result).toContain('</html>')
    expect(result).toContain('<meta charset="utf-8">')
    expect(result).toContain('<title>Converted</title>')
    expect(result).toContain('<body>')
    expect(result).toContain('</body>')
  })

  it('converts h1 through h6 headings', () => {
    expect(convert('# h1')).toContain('<h1>h1</h1>')
    expect(convert('## h2')).toContain('<h2>h2</h2>')
    expect(convert('### h3')).toContain('<h3>h3</h3>')
    expect(convert('#### h4')).toContain('<h4>h4</h4>')
    expect(convert('##### h5')).toContain('<h5>h5</h5>')
    expect(convert('###### h6')).toContain('<h6>h6</h6>')
  })

  it('converts bold (**text**)', () => {
    const result = convert('**bold**')
    expect(result).toContain('<strong>bold</strong>')
  })

  it('converts italic (*text*)', () => {
    const result = convert('*italic*')
    expect(result).toContain('<em>italic</em>')
  })

  it('converts bold italic (***text***)', () => {
    const result = convert('***bold italic***')
    expect(result).toContain('<strong><em>bold italic</em></strong>')
  })

  it('converts inline code (`code`)', () => {
    const result = convert('use `code` here')
    expect(result).toContain('<code>code</code>')
  })

  it('converts links [text](url)', () => {
    const result = convert('[click](https://example.com)')
    expect(result).toContain('<a href="https://example.com">click</a>')
  })

  it('image syntax ![alt](src) is processed by the link regex first (known limitation)', () => {
    const result = convert('![logo](img.png)')
    // The link regex \[...\]\(...\) matches first, leaving the ! as plain text
    expect(result).toContain('!<a href="img.png">logo</a>')
    // The image regex never gets a chance
    expect(result).not.toContain('<img')
  })

  it('code blocks are not converted correctly because inline code regex runs first (known limitation)', () => {
    const md = '```ts\nconst x = 1\n```'
    // The inline code regex /`(.+?)`/g runs before the code-block regex, so
    // triple backticks get consumed as inline code first, and the code-block
    // pattern never matches
    expect(convert(md)).toContain('<code>`</code>')
    expect(convert(md)).not.toContain('<pre>')
  })

  it('code blocks without language annotation have the same limitation', () => {
    const md = '```\nplain code\n```'
    expect(convert(md)).not.toContain('<pre>')
  })

  it('converts horizontal rules (---)', () => {
    expect(convert('---')).toContain('<hr />')
  })

  it('converts paragraphs separated by double newlines', () => {
    const md = 'para one\n\npara two'
    const result = convert(md)
    expect(result).toContain('<p>para one</p>')
    expect(result).toContain('<p>para two</p>')
  })

  it('converts single newlines within a paragraph to <br />', () => {
    const result = convert('line1\nline2')
    expect(result).toContain('line1<br />line2')
  })
})

// ── htmlToMarkdown ──

describe('htmlToMarkdown', () => {
  const convert = (html: string) => convertInBrowser(html, 'html', 'markdown')

  it('converts h1 to h6 headings to # syntax', () => {
    expect(convert('<h1>Title</h1>')).toContain('# Title')
    expect(convert('<h2>Sub</h2>')).toContain('## Sub')
    expect(convert('<h3>Sub3</h3>')).toContain('### Sub3')
    expect(convert('<h4>Sub4</h4>')).toContain('#### Sub4')
    expect(convert('<h5>Sub5</h5>')).toContain('##### Sub5')
    expect(convert('<h6>Sub6</h6>')).toContain('###### Sub6')
  })

  it('handles headings with HTML attributes', () => {
    expect(convert('<h1 id="title" class="main">Title</h1>')).toContain('# Title')
  })

  it('converts <strong> to **text**', () => {
    expect(convert('<strong>important</strong>')).toContain('**important**')
  })

  it('converts <em> to *text*', () => {
    expect(convert('<em>emphasis</em>')).toContain('*emphasis*')
  })

  it('converts <code> to backtick code', () => {
    expect(convert('<code>fn()</code>')).toContain('`fn()`')
  })

  it('converts <a> links to [text](url) format', () => {
    expect(convert('<a href="https://example.com">link</a>')).toContain('[link](https://example.com)')
  })

  it('converts links with extra attributes', () => {
    expect(convert('<a href="https://x.com" target="_blank">link</a>')).toContain('[link](https://x.com)')
  })

  it('converts <img> tags to ![image](src) format', () => {
    expect(convert('<img src="pic.png" alt="photo" />')).toContain('![image](pic.png)')
  })

  it('handles img tags without alt text', () => {
    expect(convert('<img src="pic.png" />')).toContain('![image](pic.png)')
  })

  it('converts <pre><code> blocks (preserves trailing newline from source)', () => {
    const html = '<pre><code>const x = 1\n</code></pre>'
    // The captured content includes the trailing \n, resulting in an extra blank line
    expect(convert(html)).toContain('```\nconst x = 1\n\n```')
  })

  it('strips unrecognised HTML tags via the catch-all regex', () => {
    const result = convert('<div><p>content</p></div>')
    expect(result).toContain('content')
    expect(result).not.toContain('<div>')
    expect(result).not.toContain('</div>')
  })

  it('converts <p> paragraphs', () => {
    const result = convert('<p>hello world</p>')
    expect(result).toContain('hello world')
  })

  it('converts <br> and <br /> to newlines', () => {
    const result = convert('line1<br>line2<br />line3')
    expect(result).toContain('line1')
    expect(result).toContain('line2')
    expect(result).toContain('line3')
  })

  it('collapses three or more consecutive newlines into two', () => {
    const result = convert('<p>a</p><p>b</p><p>c</p>')
    expect(result).not.toMatch(/\n{3,}/)
  })

  it('trims leading and trailing whitespace', () => {
    const result = convert('<p>content</p>')
    expect(result).toBe(result.trim())
  })
})

// ── getConverterId ──

describe('getConverterId', () => {
  it('returns "json->csv" for json/csv pair', () => {
    expect(getConverterId('json', 'csv')).toBe('json->csv')
  })

  it('returns "csv->json" for csv/json pair', () => {
    expect(getConverterId('csv', 'json')).toBe('csv->json')
  })

  it('returns "json->yaml" for json/yaml pair', () => {
    expect(getConverterId('json', 'yaml')).toBe('json->yaml')
  })

  it('returns "yaml->json" for yaml/json pair', () => {
    expect(getConverterId('yaml', 'json')).toBe('yaml->json')
  })

  it('returns "json->toml" for json/toml pair', () => {
    expect(getConverterId('json', 'toml')).toBe('json->toml')
  })

  it('returns "json->xml" for json/xml pair', () => {
    expect(getConverterId('json', 'xml')).toBe('json->xml')
  })

  it('returns "markdown->html" for markdown/html pair', () => {
    expect(getConverterId('markdown', 'html')).toBe('markdown->html')
  })

  it('returns "html->markdown" for html/markdown pair', () => {
    expect(getConverterId('html', 'markdown')).toBe('html->markdown')
  })

  it('returns null for an unsupported pair (json -> pdf)', () => {
    expect(getConverterId('json', 'pdf')).toBeNull()
  })

  it('returns null for csv -> yaml (not defined)', () => {
    expect(getConverterId('csv', 'yaml')).toBeNull()
  })

  it('returns null for completely unknown formats', () => {
    expect(getConverterId('foo', 'bar')).toBeNull()
  })
})

// ── isBrowserConvertible ──

describe('isBrowserConvertible', () => {
  it('returns true for all eight defined conversions', () => {
    expect(isBrowserConvertible('json', 'csv')).toBe(true)
    expect(isBrowserConvertible('csv', 'json')).toBe(true)
    expect(isBrowserConvertible('json', 'yaml')).toBe(true)
    expect(isBrowserConvertible('yaml', 'json')).toBe(true)
    expect(isBrowserConvertible('json', 'toml')).toBe(true)
    expect(isBrowserConvertible('json', 'xml')).toBe(true)
    expect(isBrowserConvertible('markdown', 'html')).toBe(true)
    expect(isBrowserConvertible('html', 'markdown')).toBe(true)
  })

  it('returns false for unsupported conversions', () => {
    expect(isBrowserConvertible('json', 'pdf')).toBe(false)
    expect(isBrowserConvertible('csv', 'yaml')).toBe(false)
    expect(isBrowserConvertible('xml', 'json')).toBe(false)
    expect(isBrowserConvertible('toml', 'json')).toBe(false)
    expect(isBrowserConvertible('yaml', 'toml')).toBe(false)
  })

  it('returns false for empty source string', () => {
    expect(isBrowserConvertible('', 'json')).toBe(false)
  })

  it('returns false for empty target string', () => {
    expect(isBrowserConvertible('json', '')).toBe(false)
  })

  it('is case-sensitive (lowercase required)', () => {
    expect(isBrowserConvertible('JSON', 'CSV')).toBe(false)
  })
})

// ── convertInBrowser ──

describe('convertInBrowser', () => {
  it('performs a valid json -> csv conversion', () => {
    const result = convertInBrowser('[{"a":1}]', 'json', 'csv')
    expect(result).toBe('a\n1')
  })

  it('performs a valid csv -> json conversion', () => {
    const result = convertInBrowser('a,b\n1,2', 'csv', 'json')
    expect(JSON.parse(result)).toEqual([{ a: '1', b: '2' }])
  })

  it('performs a valid json -> yaml conversion', () => {
    const result = convertInBrowser('{"key":"val"}', 'json', 'yaml')
    expect(result).toContain('key: val')
  })

  it('performs a valid yaml -> json conversion', () => {
    const result = convertInBrowser('key: val', 'yaml', 'json')
    expect(JSON.parse(result)).toEqual({ key: 'val' })
  })

  it('performs a valid json -> toml conversion', () => {
    const result = convertInBrowser('{"key":"val"}', 'json', 'toml')
    expect(result).toContain('key = "val"')
  })

  it('performs a valid json -> xml conversion', () => {
    const result = convertInBrowser('{"key":"val"}', 'json', 'xml')
    expect(result).toContain('<key>val</key>')
  })

  it('performs a valid markdown -> html conversion', () => {
    const result = convertInBrowser('# Hello', 'markdown', 'html')
    expect(result).toContain('<h1>Hello</h1>')
  })

  it('performs a valid html -> markdown conversion', () => {
    const result = convertInBrowser('<h1>Hello</h1>', 'html', 'markdown')
    expect(result).toContain('# Hello')
  })

  it('throws an error with a descriptive message for unsupported conversion', () => {
    expect(() => convertInBrowser('{}', 'json', 'pdf')).toThrow('不支持的浏览器内转换')
  })

  it('throws an error including both source and target format names', () => {
    expect(() => convertInBrowser('{}', 'csv', 'yaml')).toThrow('csv → yaml')
  })

  it('propagates JSON parse errors from the underlying converter', () => {
    expect(() => convertInBrowser('not valid json', 'json', 'csv')).toThrow()
  })
})

// ── getOutputExtension ──

describe('getOutputExtension', () => {
  it('returns "json" for json format', () => {
    expect(getOutputExtension('json')).toBe('json')
  })

  it('returns "csv" for csv format', () => {
    expect(getOutputExtension('csv')).toBe('csv')
  })

  it('returns "yaml" for yaml format', () => {
    expect(getOutputExtension('yaml')).toBe('yaml')
  })

  it('returns "yaml" for yml format (alias)', () => {
    expect(getOutputExtension('yml')).toBe('yaml')
  })

  it('returns "toml" for toml format', () => {
    expect(getOutputExtension('toml')).toBe('toml')
  })

  it('returns "xml" for xml format', () => {
    expect(getOutputExtension('xml')).toBe('xml')
  })

  it('returns "md" for markdown format', () => {
    expect(getOutputExtension('markdown')).toBe('md')
  })

  it('returns "html" for html format', () => {
    expect(getOutputExtension('html')).toBe('html')
  })

  it('returns the input string unchanged for an unknown format', () => {
    expect(getOutputExtension('pdf')).toBe('pdf')
  })

  it('returns "unknown" for an unrecognised format', () => {
    expect(getOutputExtension('unknown')).toBe('unknown')
  })

  it('returns empty string for empty input', () => {
    expect(getOutputExtension('')).toBe('')
  })
})
