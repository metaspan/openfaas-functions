'use strict'
const axios = require('axios')
const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')
const { ApiPromise, WsProvider } = require('@polkadot/api')

const { HTTPLogger } = require('./HTTPLogger')
const LOGGER_HOST = process.env.LOGGER_HOST || 'gateway'
const LOGGER_PORT = process.env.LOGGER_PORT || 8080
const logger = new HTTPLogger({hostname: LOGGER_HOST, port: LOGGER_PORT})

const CHAIN = process.env.CHAIN || 'kusama'
const UPDATE_URL = `https://${CHAIN}.w3f.community/candidates`

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_COLLECTION = process.env.MONGO_COLLECTION || '1kv_candidate'

const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`
const FUNCTION = `w3f-1kv-candidates-${CHAIN}-update`

// Database Pool Connection
var dbc

// const logEvent = async function (event) {
//   console.log(JSON.stringify(event))
//   await logger.debug(`w3f-1kv-candidates-${CHAIN}-update`, event)
// }

const prepareDB = async function () {
  // const url = "mongodb://" + process.env.mongo + ":27017/clients"
  return new Promise((resolve, reject) => {
    if (dbc) {
      console.warn("1kv-candidates: DB already connected.")
      return resolve(dbc)
    }
    console.warn("DB connecting")
    MongoClient.connect(MONGO_CONNECTION_URL, (err, client) => {
      if (err) { return reject(err) }
      // client.on('error', logEvent)
      // client.on('connect', logEvent)
      // client.on('disconnect', logEvent)
      // client.on('reconnect', logEvent)
      dbc = client.db(MONGO_DATABASE)
      return resolve(dbc)
    })
  })
}

// async function getEndpoints () {
//   const res = await axios.get('https://api.metaspan.io/function/w3f-endpoints')
//   return res.data
// }

// async function getStakingValidators(api) {
//   // // const keys = await api.query.staking.validators.keys()
//   // const keys = await api.query.session.validators()
//   // // console.log(keys)
//   // // const ids = keys.map(({ args: [stash] }) => stash.toJSON())
//   // var ids = keys.map(k => k.toString())
//   // // keys.forEach(key => {
//   // //   console.log(key.toString())
//   // // })
//   // console.log(ids)
//   return ids
// }

function slog (str) { console.log('1kv-candidates:' + str) }

module.exports = async (event, context) => {

  // console.log(JSON.stringify(context))
  // console.log(JSON.stringify(event))
  await logger.debug(FUNCTION, event)
  // const endpoints = await getEndpoints()
  // const provider = new WsProvider(endpoints[CHAIN]['local'])
  // const api = await ApiPromise.create({ provider: provider })
  // const active_vals = await getStakingValidators(api)
  // const active_vals = await getStakingValidators()
  var vals = await axios.get(`http://192.168.1.92:3000/${CHAIN}/query/session/validators`)
  // console.log(res.data)
  const active_vals = vals.data || []

  var res
  var result
  try {
    res = await axios.get(UPDATE_URL)
  } catch (err) {
    slog('ERROR getting candidates from ' + UPDATE_URL)
    console.log(err.response)
    // await logger.error(FUNCTION, err.response.code)
  }

  if (res && res.data) {
    const candidates = res.data
    // update the db
    // const client = new MongoClient(MONGO_CONNECTION_URL)
    try {
      // await client.connect()
      // const database = client.db("mspn_io_api")
      await prepareDB()
      const col = dbc.collection(MONGO_COLLECTION)

      // de-activate candidates no longer in the list
      let stashes = candidates.map(m => m.stash)
      let update = { $set: { stale: true, updatedAt: moment().utc().format() } }
      slog('Updating stale=true batch')
      await col.updateMany({ chain: CHAIN, stale: false, stash: { '$nin': stashes } }, update)

      // upsert all [new] candidates
      slog('starting candidates.forEach()')
      // candidates.forEach(async (candidate) => {
      for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i]
        // slog('handling candidate ' + JSON.stringify(candidate))
        const query = {
          chain: CHAIN,
          // _id: candidate._id,
          stash: candidate.stash
        }
        candidate.chain = CHAIN
        // recalculate 'valid'
        candidate.valid = candidate.validity.filter(f => f.valid === false).length === 0
        candidate.stale = false
        candidate.active = active_vals.includes(candidate.stash) ? 1 : 0
        candidate.updatedAt = moment().utc().format()
        slog('upserting candidate '+ candidate.stash)
        const result = await col.replaceOne(query, candidate, { upsert: true })
      }
      result = {
        candidates_updated: candidates.length,
        candidates: candidates.map(n => { return { _id: n._id, stash: n.stash } }),
        // 'content-type': event.headers["content-type"]
        'content-type': 'application/json'
      }
    } catch (err) {
      console.log(err)
      await logger.error(FUNCTION, err)
      result = {
        error: JSON.stringify(err),
        // 'content-type': event.headers["content-type"],
        'content-type': 'application/json'
      }
    // } finally {
    //   await client.close()
    }

  } else {
    slog('res.data was empty')
    result = {
      reason: 'res.data was empty',
      'body': JSON.stringify(event.body),
    }
  }
  slog('done...')

  return context
    .status(200)
    .headers({'content-type': 'text/json'})
    .succeed(result)

}
