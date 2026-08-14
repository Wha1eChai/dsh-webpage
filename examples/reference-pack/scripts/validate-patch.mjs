import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const patchPath = new URL('../cordis.patch.yml', import.meta.url)

function fail(message) {
  throw new Error(`Reference Pack patch validation failed: ${message}`)
}

function parsePatch(source) {
  const lines = source
    .split(/\r?\n/u)
    .map((text, index) => ({ number: index + 1, text: text.replace(/[ \t]+$/u, '') }))
    .filter(({ text }) => text.trim() !== '' && !/^\s*#/u.test(text))

  if (lines.some(({ text }) => text.includes('\t'))) fail('tabs are not allowed')

  const operations = []
  let operation
  let row

  const finishRow = () => {
    if (row === undefined) return
    if (row.name === undefined) fail(`row ${row.id} is missing name`)
    operation.rows.push(row)
    row = undefined
  }

  for (const { number, text } of lines) {
    if (text === '- insert:') {
      if (operation !== undefined) fail(`unexpected second operation at line ${number}`)
      operation = { kind: 'insert', rows: [] }
      operations.push(operation)
      continue
    }

    const id = /^    - id: ([A-Za-z0-9._-]+)$/u.exec(text)
    if (id !== null) {
      if (operation?.kind !== 'insert') fail(`row without insert operation at line ${number}`)
      finishRow()
      row = { id: id[1] }
      continue
    }

    const name = /^      name: '([^']+)'$/u.exec(text)
    if (name !== null) {
      if (row === undefined) fail(`name without row at line ${number}`)
      if (row.name !== undefined) fail(`duplicate name for row ${row.id} at line ${number}`)
      row.name = name[1]
      continue
    }

    fail(`unsupported patch syntax at line ${number}: ${text}`)
  }

  finishRow()
  return operations
}

const expectedRows = [
  { id: 'webpage', name: '@wha1echai/dsh-webpage' },
  { id: 'reference-app', name: '@wha1echai/dsh-webpage-reference-app' },
  { id: 'reference-extension', name: '@wha1echai/dsh-webpage-reference-extension' },
]

const source = await readFile(patchPath, 'utf8')
const operations = parsePatch(source)
assert.equal(operations.length, 1, 'patch must contain exactly one operation')
assert.equal(operations[0].kind, 'insert', 'patch operation must be insert')
assert.deepEqual(operations[0].rows, expectedRows, 'patch rows must match the dependency-safe order exactly')
console.log(`Validated reference Pack patch: ${expectedRows.map(({ name }) => name).join(' -> ')}`)
