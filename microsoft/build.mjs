// Prépare les fichiers à installer dans PowerPoint et Teams, pour une adresse HTTPS donnée.
//
//   node microsoft/build.mjs                              -> PowerPoint sur https://localhost:3443
//   node microsoft/build.mjs abcd-efgh.trycloudflare.com  -> PowerPoint + Teams via le tunnel
//
// Résultat dans microsoft/out/ : powerpoint-manifest.xml et (avec un tunnel) quizflow-teams.zip.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'out')
mkdirSync(out, { recursive: true })

// Adresse : « abcd.trycloudflare.com », « https://abcd.trycloudflare.com/ » ou rien (localhost:3443).
const arg = (process.argv[2] || 'localhost:3443').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
if (!/^[a-z0-9.-]+(:\d+)?$/i.test(arg)) {
  console.error(`Adresse invalide : ${process.argv[2]}`)
  process.exit(1)
}
const origin = `https://${arg}`
const fill = (text) => text.replaceAll('{{ORIGIN}}', origin).replaceAll('{{HOST}}', arg)

// 1) PowerPoint
writeFileSync(join(out, 'powerpoint-manifest.xml'), fill(readFileSync(join(here, 'powerpoint', 'manifest.template.xml'), 'utf8')))
console.log(`✔ microsoft/out/powerpoint-manifest.xml  (${origin}/office)`)

// 2) Teams : impossible avec localhost, Teams a besoin d'une adresse publique.
if (arg.startsWith('localhost')) {
  console.log('ℹ Pour Teams, relancez avec l’adresse du tunnel : node microsoft/build.mjs xxxx.trycloudflare.com')
  process.exit(0)
}
const files = [
  ['manifest.json', Buffer.from(fill(readFileSync(join(here, 'teams', 'manifest.template.json'), 'utf8')))],
  ['color.png', readFileSync(join(here, 'teams', 'color.png'))],
  ['outline.png', readFileSync(join(here, 'teams', 'outline.png'))],
]
writeFileSync(join(out, 'quizflow-teams.zip'), zip(files))
console.log(`✔ microsoft/out/quizflow-teams.zip  (${origin}/teams)`)

/** Petit fichier .zip (sans dépendance) : les fichiers sont à la racine, comme Teams le demande. */
function zip(entries) {
  const parts = []
  const central = []
  let offset = 0
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name)
    const packed = deflateRawSync(data)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt32LE(0, 10) // date/heure
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    parts.push(local, nameBuf, packed)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0, 8)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt32LE(0, 12)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(packed.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(nameBuf.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, nameBuf)
    offset += 30 + nameBuf.length + packed.length
  }
  const dir = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(dir.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, dir, end])
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
