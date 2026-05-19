import fs from 'fs'

const WS_KEY = 'BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B'
const host = process.env.PRESTASHOP_HOST || 'http://localhost'
const url = `${host}/prestashop/api/orders/9`

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(WS_KEY + ':').toString('base64'),
        'Content-Type': 'application/xml'
      }
    })

    const text = await res.text()
    console.log('HTTP', res.status, res.statusText)
    console.log('--- XML START ---')
    console.log(text)
    console.log('--- XML END ---')
    fs.writeFileSync('order9.xml', text)
  } catch (err) {
    console.error('Fetch error', err)
  }
}

run()
