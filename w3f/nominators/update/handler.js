'use strict'
const axios = require('axios')
// const { ApiPromise, WsProvider } = require('@polkadot/api')
// const { hexToString } = require('@polkadot/util')
// // const { endpoints } = require('./endpoints.js')
// var endpoints = {}

const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')
const { HTTPLogger } = require('./HTTPLogger')

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))

const LOGGER_HOST = process.env.LOGGER_HOST || 'gateway'
const LOGGER_PORT = process.env.LOGGER_PORT || 8080
const logger = new HTTPLogger({hostname: LOGGER_HOST, port: LOGGER_PORT})

const CHAIN = process.env.CHAIN || 'kusama'
const PROVIDER = process.env.PROVIDER || 'local'

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_COLLECTION = 'w3f_nominator'
const DOTASMA_API_BASE = env.DOTASMA_API_BASE || 'http://gateway:8080'

const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`

const FUNCTION = `w3f-nominators-${CHAIN}-update`

// async function getEndpoints () {
//   // const res = await axios.get('https://api.metaspan.io/function/w3f-endpoints')
//   const res = await axios.get('http://gateway:8080/function/w3f-endpoints')
//   return res.data
// }

async function getAllNominators (batchSize=256) {
  // if (fs.existsSync(`${options.chain}-nominators.json`)) {
  //   slog(`serving nominators from ${options.chain}-nominators.json`)
  //   return JSON.parse(fs.readFileSync(`${options.chain}-nominators.json`, 'utf-8'))
  // }
  // const nominators = await api.query.staking.nominators.entries();
  // const nominatorAddresses = nominators.map(([address]) => ""+address.toHuman()[0]);
  let res = await axios.get(`${DOTASMA_API_BASE}/${CHAIN}/query/staking/nominators`)
  const nominatorAddresses = res?.data?.nominators || []
  console.debug(`the nominator addresses size is ${nominatorAddresses.length}, working in chunks of ${batchSize}`)
  //A too big nominators set could make crush the API => Chunk splitting
  var nominatorAddressesChucked = []
  for (let i = 0; i < nominatorAddresses.length; i += batchSize) {
    const chunk = nominatorAddresses.slice(i, i + batchSize)
    nominatorAddressesChucked.push(chunk)
  }
  var nominatorsStakings = []
  var idx = 0
  for (const chunk of nominatorAddressesChucked) {
    console.debug(`${++idx} of ${nominatorAddressesChucked.length} (chunkSize=${chunk.length})`)
    // const accounts = await api.derive.staking.accounts(chunk)
    res = await axios.post(`${DOTASMA_API_BASE}/${CHAIN}/derive/staking/accounts`, { ids: chunk })
    const accounts = res?.data?.accounts || []
    // nominatorsStakings.push(...accounts.map(a => {
    //   return {
    //     nextSessionIds: a.nextSessionIds,
    //     sessionIds: a.sessionIds,
    //     accountId: a.accountId.toHuman(),
    //     controllerId: a.controllerId.toHuman(),
    //     exposure: a.exposure.toJSON(),
    //     // nominators: a.nominators.toJSON(),
    //     targets: a.nominators.toJSON(),
    //     rewardDestination: a.rewardDestination.toJSON(),
    //     validatorPrefs: a.validatorPrefs.toJSON(),
    //     redeemable: a.redeemable.toHuman(),
    //     unlocking: a.unlocking
    //   }
    // }))
    nominatorsStakings.push(...accounts)
    // console.debug(nominatorsStakings[0])
    // return nominatorsStakings
  }
  // fs.writeFileSync(`${options.chain}-nominators.json`, JSON.stringify(nominatorsStakings, {}, 2), 'utf-8')
  return nominatorsStakings
}

module.exports = async (event, context) => {

  await logger.debug(FUNCTION, event)
  var res = await axios.get(`http://192.168.1.2:1880/job-log?host=gateway&name=function:${FUNCTION}&action=start`)
  const { id } = res.data

  var nominators = []
  var result
  // var endpoints = await getEndpoints()

  try {
    // const provider = new WsProvider(endpoints[CHAIN][PROVIDER])
    // const api = await ApiPromise.create({ provider: provider })
    nominators = await getAllNominators(128)
  } catch (err) {
    await logger.error(FUNCTION, err)
  }

  console.log('updating database...')
  const client = new MongoClient(MONGO_CONNECTION_URL)
  try {
    await client.connect()
    const database = client.db("mspn_io_api")
    const col = database.collection(MONGO_COLLECTION)
    nominators.forEach(async (nominator) => {
      const query = {
        chain: CHAIN,
        accountId: nominator.accountId,
      }
      nominator.chain = CHAIN
      nominator.updatedAt = moment().utc().format()
      const result = await col.replaceOne(query, nominator, { upsert: true })
    })
    result = {
      nominators_updated: nominators.length,
      nominators: nominators.map(n => { return { _id: n._id, stash: n.stash } }),
      // 'content-type': event.headers["content-type"]
      'content-type': 'application/json'
    }
  } catch (err) {
    await logger.error(FUNCTION, err)
    result = {
      error: err,
      // 'content-type': event.headers["content-type"],
      'content-type': 'application/json'
    }
  }
  console.log('done...')
  await axios.get(`http://192.168.1.2:1880/job-log?id=${id}&action=stop`)

  return context
    .status(200)
    .headers({ 'content-type': 'text/json' })
    .succeed(result)

}
