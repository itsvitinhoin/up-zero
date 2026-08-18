import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const adminRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const storefrontRoot = resolve(adminRoot, '..', 'next-upvitrine')

if (!existsSync(resolve(storefrontRoot, 'package.json'))) {
  console.error(`[local] Vitrine não encontrada em ${storefrontRoot}`)
  process.exit(1)
}

const services = [
  {
    name: 'API',
    cwd: adminRoot,
    command: process.execPath,
    args: [resolve(adminRoot, 'scripts', 'sandbox-api.mjs')],
  },
  {
    name: 'ADMIN',
    cwd: adminRoot,
    command: 'npm',
    args: ['run', 'dev'],
  },
  {
    name: 'VITRINE',
    cwd: storefrontRoot,
    command: 'npm',
    args: ['run', 'dev', '--', '--port', '3001'],
  },
]

const children = services.map((service) => {
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  const write = (stream, chunk) => {
    const lines = String(chunk).split(/\r?\n/)
    for (const line of lines) {
      if (line) stream.write(`[${service.name}] ${line}\n`)
    }
  }
  child.stdout.on('data', (chunk) => write(process.stdout, chunk))
  child.stderr.on('data', (chunk) => write(process.stderr, chunk))
  child.on('exit', (code, signal) => {
    if (code && code !== 0) console.error(`[${service.name}] finalizou com código ${code}`)
    if (signal) console.error(`[${service.name}] finalizou com sinal ${signal}`)
  })
  return child
})

console.log('[local] Admin:    http://localhost:3000')
console.log('[local] Vitrine:  http://localhost:3001/1043')
console.log('[local] API:      http://localhost:8080/sandbox/status')
console.log('[local] Use Ctrl+C para encerrar todos os serviços.')

const stop = () => {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
}

process.once('SIGINT', () => {
  stop()
  process.exit(0)
})
process.once('SIGTERM', () => {
  stop()
  process.exit(0)
})
