#!/usr/bin/env node
// scripts/push.js — bump minor version, update release notes, commit, push

const fs = require('fs')
const { execSync } = require('child_process')

const PKG_PATH = 'package.json'
const RELEASES_PATH = 'src/data/releases.js'

// ── 1. Bump minor version ────────────────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'))
const [major, minor] = pkg.version.split('.').map(Number)
const newVersion = `${major}.${minor + 1}.0`
pkg.version = newVersion
fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n')
console.log(`Version: ${major}.${minor}.0 → ${newVersion}`)

// ── 2. Collect commits since last version bump ───────────────────────────────
let rawLog
try {
  // Find the most recent "chore: bump version" commit
  const lastBump = execSync(
    'git log --oneline --grep="chore: bump version" -1 --format="%H"',
    { encoding: 'utf8' }
  ).trim()

  rawLog = lastBump
    ? execSync(`git log ${lastBump}..HEAD --oneline --format="%s"`, { encoding: 'utf8' })
    : execSync('git log -10 --oneline --format="%s"', { encoding: 'utf8' })
} catch {
  rawLog = ''
}

const notes = rawLog
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('chore: bump version'))

if (notes.length === 0) notes.push('Minor improvements and bug fixes')

// ── 3. Update releases.js ────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)
const newEntry = { version: newVersion, date: today, notes }

const releasesContent = fs.readFileSync(RELEASES_PATH, 'utf8')
const insertAfter = 'export const releases = ['
const entryStr =
  '\n  ' +
  JSON.stringify(newEntry, null, 2).replace(/\n/g, '\n  ') +
  ','

const updated = releasesContent.replace(insertAfter, insertAfter + entryStr)
fs.writeFileSync(RELEASES_PATH, updated)
console.log(`Release notes added for v${newVersion}:`)
notes.forEach(n => console.log(`  • ${n}`))

// ── 4. Commit & push ─────────────────────────────────────────────────────────
execSync(`git add ${PKG_PATH} ${RELEASES_PATH}`)
execSync(`git commit -m "chore: bump version to ${newVersion}"`)
execSync('git push origin main')
console.log(`\nPushed v${newVersion} ✓`)
