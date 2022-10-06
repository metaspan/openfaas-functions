'use strict'
const axios = require('axios')
const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')
const { ApiPromise, WsProvider } = require('@polkadot/api')

const { HTTPLogger } = require('./HTTPLogger')
const logger = new HTTPLogger({hostname: '192.168.1.82'})

const CHAIN = process.env.CHAIN || 'kusama'
const UPDATE_URL = `https://${CHAIN}.w3f.community/candidates`

const MONGO_HOST = process.env.MONGO_HOST || '192.168.1.2'
const MONGO_PORT = process.env.MONGO_PORT || '32768'
const MONGO_USERID = process.env.MONGO_USERID || 'mspn_io_api'
const MONGO_PASSWD = process.env.MONGO_PASSWD || 'wordpass'
const MONGO_DATABASE = process.env.MONGO_DATABASE || 'mspn_io_api'
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
      console.warn("DB already connected.")
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

async function getEndpoints () {
  const res = await axios.get('https://api.metaspan.io/function/w3f-endpoints')
  return res.data
}

async function getStakingValidators(api) {
  // const keys = await api.query.staking.validators.keys()
  const keys = await api.query.session.validators()
  // console.log(keys)
  // const ids = keys.map(({ args: [stash] }) => stash.toJSON())
  var ids = keys.map(k => k.toString())
  // keys.forEach(key => {
  //   console.log(key.toString())
  // })
  console.log(ids)
  return ids
}

module.exports = async (event, context) => {

  await logger.debug(FUNCTION, event)
  const endpoints = await getEndpoints()
  const provider = new WsProvider(endpoints[CHAIN]['local'])
  const api = await ApiPromise.create({ provider: provider })
  const active_vals = await getStakingValidators(api)

  var res
  var result
  try {
    res = await axios.get(UPDATE_URL)
  } catch (err) {
    await logger.error(FUNCTION, err)
  }

  if (res.data) {
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
      await col.updateMany({ chain: CHAIN, stale: false, stash: { '$nin': stashes } }, update)

      // upsert all [new] candidates
      candidates.forEach(async (candidate) => {
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
        const result = await col.replaceOne(query, candidate, { upsert: true })
      })
      result = {
        candidates_updated: candidates.length,
        candidates: candidates.map(n => { return { _id: n._id, stash: n.stash } }),
        // 'content-type': event.headers["content-type"]
        'content-type': 'application/json'
      }
    } catch (err) {
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
    result = {
      reason: 'res.data was empty',
      'body': JSON.stringify(event.body),
    }
  }

  return context
    .status(200)
    .headers({'content-type': 'text/json'})
    .succeed(result)

}
