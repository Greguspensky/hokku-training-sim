const { createServer } = require('https')
const { parse } = require('url')
const next = require('next')
const fs = require('fs')
const path = require('path')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0' // Listen on all interfaces
const port = 3000

// Create Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// SSL certificate paths
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, '.ssl', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '.ssl', 'cert.pem')),
}

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('Internal server error')
    }
  })
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log('')
      console.log('  ✅ HTTPS Server ready!')
      console.log('')
      console.log(`  ➜ Local:    https://localhost:${port}`)
      console.log(`  ➜ Network:  https://192.168.178.76:${port}`)
      console.log('')
      console.log('  ⚠️  Note: You\'ll see a security warning on first visit.')
      console.log('     Click "Advanced" → "Proceed to site" to accept the self-signed certificate.')
      console.log('')
    })
})
