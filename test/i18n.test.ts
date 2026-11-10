import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

// UI text belongs in src/i18n.tsx. Vietnamese letters anywhere else mean a string escaped translation.
test('no hard-coded Vietnamese UI text outside i18n.tsx', () => {
  const vietnamese = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i
  const offenders = readdirSync('src')
    .filter(f => /\.tsx?$/.test(f) && f !== 'i18n.tsx')
    .flatMap(f => readFileSync(`src/${f}`, 'utf8').split('\n')
      .map((line, i) => ({ where: `src/${f}:${i + 1}`, line }))
      .filter(({ line }) => vietnamese.test(line) && !line.trim().startsWith('//')))
  assert.deepEqual(offenders, [])
})
