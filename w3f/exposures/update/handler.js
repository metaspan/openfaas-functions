'use strict'
const axios = require('axios')
const moment = require('moment-timezone')

// const { ApiPromise, WsProvider } = require('@polkadot/api')
// const { hexToString } = require('@polkadot/util')
// // const { endpoints } = require('./endpoints.js')
// var endpoints = {}

const { MongoClient } = require('mongodb')

const { HTTPLogger } = require('./HTTPLogger')
const LOGGER_HOST = process.env.LOGGER_HOST || 'gateway'
const LOGGER_PORT = process.env.LOGGER_PORT || 8080
const logger = new HTTPLogger({hostname: LOGGER_HOST, port: LOGGER_PORT})

const CHAIN = process.env.CHAIN || 'kusama'
// const UPDATE_URL = `https://${CHAIN}.w3f.community/exposures`
const PROVIDER = process.env.PROVIDER || 'local'

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`

const MONGO_COLLECTION = "w3f_exposure"

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

// async function getEndpoints () {
//   const res = await axios.get('https://api.metaspan.io/function/w3f-endpoints')
//   return res.data
// }

// async function getAllExposures (api, chain) {
async function getAllExposures () {
  // Retrieve the active era
  // var activeEra = await api.query.staking.activeEra()
  // activeEra = activeEra.toJSON()
  var res = await axios.get(`http://192.168.1.92:3000/${CHAIN}/query/staking/activeEra`)
  var activeEra = res?.data?.activeEra || 0
  console.log(activeEra)
  // retrieve all exposures for the active era
  // const entries = await api.query.staking.erasStakers.entries(activeEra.index)
  // var list = []
  // asyncForEach(entries, ([key, exposure]) => {
  //   // console.log('key arguments:', key.args.map((k) => k.toHuman()))
  //   // console.log('     exposure:', exposure.toHuman())
  //   var exp = exposure.toJSON()
  //   var [era, stash] = key.args.map((k) => k.toHuman())
  //   exp.era = parseInt(era.replace(',',''))
  //   exp.total = parseInt(exp.total, 16)
  //   exp.stash = stash
  //   exp.chain = chain
  //   list.push(exp)
  // })
  res = await axios.get(`http://192.168.1.92:3000/${CHAIN}/query/staking/erasStakers?index=${activeEra.index}`)
  // return list
  return res?.data?.activeEra || []
}

module.exports = async (event, context) => {

  const FUNCTION = `w3f-1kv-exposures-${CHAIN}-update`
  await logger.debug(FUNCTION, event)
  var res = await axios.get(`http://192.168.1.2:1880/job-log?host=gateway&name=function:${FUNCTION}&action=start`)
  const { id } = res.data
  // await logger.debug(FUNCTION, event)
  var result

  // endpoints = await getEndpoints()

  // const provider = new WsProvider(endpoints[CHAIN][PROVIDER])
  // const api = await ApiPromise.create({ provider: provider })

  // const exposures = await getAllExposures(api, CHAIN)
  const exposures = await getAllExposures()

  // update the db
  const client = new MongoClient(MONGO_CONNECTION_URL)
  try {
    await client.connect()
    const database = client.db("mspn_io_api")
    const col = database.collection(MONGO_COLLECTION)
    exposures.forEach(async (exposure) => {
      // slog(`updating ${exposure.stash}`)
      // console.log(exposure)
      const query = {
        // _id: validator._id,
        era: exposure.era,
        stash: exposure.stash,
        chain: exposure.chain
      }
      // exposure.chain = CHAIN
      exposure.updatedAt = moment().utc().format()
      const result = await col.replaceOne(query, exposure, { upsert: true })
    })
    result = {
      exposures_updated: exposures.length,
      exposures: exposures.map(n => { return { _id: n._id, stash: n.stash } }),
      'content-type': 'application/json'
    }
  } catch (err) {
    await logger.error(`1kv-exposures-${CHAIN}-update`, err)
    result = {
      error: err,
      'content-type': 'application/json'
    }
  }

  await axios.get(`http://192.168.1.2:1880/job-log?id=${id}&action=stop`)

  return context
    .status(200)
    .succeed(result)

}
