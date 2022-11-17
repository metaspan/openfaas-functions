'use strict'

const axios = require('axios')
// const moment = require('moment-timezone')

// async function logEvent(event) {
//   console.log(event)
// }

const BASE_URL = process.env.BASE_URL || 'https://api.binance.com'

function slog (str) { console.log('mongo-logger: ' + str) }

module.exports = async (event, context) => {

  slog('starting...', event)
  // const fn = event.path.replace('/', '')
  // const data = event.body
  console.log(event)
  var result

  try {
    const params = event.query
    if (params.symbols) params.symbols = `["${params.symbols.join('","')}"]`
    const res = await axios.get(`${BASE_URL}${event.path}`, { params })
    result = res.data || {}
  } catch (err) {
    slog('got an error...!')
    console.error(err)
    result = {
      error: err
    }
  }
  slog('done...' + JSON.stringify(result))

  return context
    .status(200)
    .headers({'content-type': 'text/json'})
    .succeed(result)
}
