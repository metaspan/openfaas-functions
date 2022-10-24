
const axios = require('axios')
const moment = require('moment-timezone')

// http://192.168.1.91:8080/function/mongo-logger
const DEFAULTS = {
  protocol: 'http',
  hostname: 'gateway',
  port: '8080',
  service: '/function/mongo-logger'
}

class HTTPLogger {
  config = {}
  base_url = ''

  constructor(config) {
    console.log('HTTPLogger: config', config)
    this.config = { ...DEFAULTS, ...config }
    this.base_url = `${this.config.protocol}://${this.config.hostname}:${this.config.port}${this.config.service}`
    console.log('HTTPLogger: config', this.config, this.url)
  }

  async log (fn, event, level='info') {
    // const data = {
    //   datetime: moment().utc().format(),
    //   level,
    //   function: fn,
    //   event
    // }
    const url = `${this.base_url}?function=${fn}&level=${level}`
    console.log('url:', url)
    try {
      const res = await axios.post(url, event)
      return res.data
    } catch (err) {
      console.log(err)
      return {error: true}
    }
  }

  async debug (fn, event) { return this.log(fn, event, 'debug') }
  async info (fn, event) { return this.log(fn, event, 'info') }
  async warn (fn, event) { return this.log(fn, event, 'warn') }
  async error (fn, event) { return this.log(fn, event, 'error') }
}

module.exports = { HTTPLogger }
