'use strict'
const axios = require('axios')
// const { ApiPromise, WsProvider } = require('@polkadot/api')
// const { hexToString } = require('@polkadot/util')
// // const { endpoints } = require('./endpoints.js')
// var endpoints = {}

const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')
const { HTTPLogger } = require('./HTTPLogger')

const LOGGER_HOST = process.env.LOGGER_HOST || 'gateway'
const LOGGER_PORT = process.env.LOGGER_PORT || 8080
const logger = new HTTPLogger({hostname: LOGGER_HOST, port: LOGGER_PORT})

const CHAIN = process.env.CHAIN || 'kusama'
const PROVIDER = process.env.PROVIDER || 'local'
const REST_API_BASE = process.env.REST_API_BASE || 'http://192.168.1.92:3000'

// this is not complete, only contains 1kv noms
// const UPDATE_URL = `https://${CHAIN}.w3f.community/nominators`

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_COLLECTION = 'w3f_validator'
const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`

const FUNCTION = `w3f-validators-${CHAIN}-update`

function slog(text) {
  console.log(text)
}

// async function getEndpoints () {
//   const res = await axios.get('https://api.metaspan.io/function/w3f-endpoints')
//   return res.data
// }

function shortStash(stash) {
  return stash.slice(0, 6) + '...' + stash.slice(-6)
}

// function parseIdentity(id) {
//   const idj = id.toJSON()
//   // console.debug('idj', idj)
//   if (idj) {
//     return {
//       deposit: idj.deposit,
//       info: {
//         // additional...
//         display: idj.info.display.raw ? hexToString(idj.info.display.raw) : '',
//         email: idj.info.email.raw ? hexToString(idj.info.email.raw) : '',
//         // image...
//         legal: idj.info.legal.raw ? hexToString(idj.info.legal.raw) : '',
//         riot: idj.info.riot.raw ? hexToString(idj.info.riot.raw) : '',
//         twitter: idj.info.twitter.raw ? hexToString(idj.info.twitter.raw) : '',
//         web: idj.info.web.raw ? hexToString(idj.info.web.raw) : ''
//       },
//       judgements: idj.judgements
//     }
//   } else {
//     return null
//   }
// }

// async function getAllCandidates (chain) {
//   try {
//     // let fnam = makeFileName(options.data, options.chain, 'candidates', 'json')
//     // if (fs.existsSync(fnam)) {
//     //   slog(`serving candidates from ${fnam}`)
//     //   return JSON.parse(fs.readFileSync(fnam, 'utf-8'))
//     // }
//     const url = `https://api.metaspan.io/api/${chain}/candidate`
//     // const url = `http://192.168.1.82:8080/function/w3f-1kv-candidates-${options.chain}`
//     const ret = await axios.get(url)
//     if (!ret.data) { slog('\n\nno data?\n\n'); console.debug(ret) }
//     const candidates = ret.data.updatedAt ? ret.data.candidates : ret.data
//     // fs.writeFileSync(fnam, JSON.stringify(candidates, {}, 2), 'utf-8')
//     return candidates
//   } catch (err) {
//     console.warn('HTTP error for candidates!')
//     console.error(err)
//     return []
//   }
// }

async function getAllValidators (batchSize=256) {
  // var ret = []
  // var validator_ids = []
  // var vals = []
  // for (var i = 0; i < nominators.length; i++) {
  //   const nom = nominators[i]
  //   for (var j = 0; j < nom.targets.length; j++) {
  //     validator_ids.push(nom.targets[j])
  //   }
  // }
  // validator_ids = [...new Set(validator_ids.sort())]

  // const entries = await api.query.staking.validators.entries() // The map from (wannabe) validator stash key to the preferences of that validator.
  const res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/staking/validators`)
  var vals = res?.data?.validators || []
  // entries.forEach(([key, validator]) => {
  //   // console.log(key.toHuman()[0])
  //   vals.push({
  //     stash: key.toHuman()[0],
  //     prefs: validator.toJSON()
  //   })
  // })

  // get any on-chain identities
  for(var i = 0; i < vals.length; i += batchSize) {
    const ids = vals.slice(i, i + batchSize).map(m => m.stash)
    // const identities = await api.query.identity.identityOf.multi(ids)
    res = axios.post(`${REST_API_BASE}/${CHAIN}/query/identity/identityOf`, { ids })
    const identities = res?.data?.identities || []
    // let example = {
    //   "judgements":[[1,{"reasonable":null}]],
    //   "deposit":1666666666660,
    //   "info":{
    //     "additional":[],
    //     "display":{"raw":"0x5855414e5f32"},
    //     "legal":{"none":null},
    //     "web":{"none":null},
    //     "riot":{"raw":"0x407875616e39333a6d61747269782e6f7267"},
    //     "email":{"raw":"0x79616e676a696e677875616e6d61696c40676d61696c2e636f6d"},
    //     "pgpFingerprint":null,
    //     "image":{"none":null},
    //     "twitter":{"none":null}
    //   }
    // }
    // const prefs = await api.query.staking.validators.multi(ids)
    for (var j = 0; j < ids.length; j++) {
      // if('DSA55HQ9uGHE5MyMouE8Geasi2tsDcu3oHR4aFkJ3VBjZG5' === ids[j]) {
      // ret.push({
      //   stash: ids[j], 
      //   shortStash: shortStash(ids[j]), 
      //   identity: parseIdentity(identities[j]),
      //   prefs: prefs[j].toJSON(),
      //   nominators: validator_nominators[ids[j]]
      // })
      vals[i+j].shortStash = shortStash(ids[j])
      // vals[i+j].identity = parseIdentity(identities[j])
      vals[i+j].identity = identities[j]
      vals[i+j].nominators = validator_nominators[ids[j]]
    }
  }
  // fs.writeFileSync(`${options.chain}-validators.json`, JSON.stringify(ret, {}, 2), 'utf-8')
  return vals
}

async function getAllNominators (batchSize=256) {
  // if (fs.existsSync(`${options.chain}-nominators.json`)) {
  //   slog(`serving nominators from ${options.chain}-nominators.json`)
  //   return JSON.parse(fs.readFileSync(`${options.chain}-nominators.json`, 'utf-8'))
  // }
  // const nominators = await api.query.staking.nominators.entries();
  // const nominatorAddresses = nominators.map(([address]) => ""+address.toHuman()[0]);
  var res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/staking/nominators`)
  const nominatorAddresses = res?.data?.nominators || []

  console.debug(`the nominator addresses size is ${nominatorAddresses.length}, working in chunks of ${batchSize}`)
  //A too big nominators set could make crush the API => Chunk splitting
  // const size = batchSize
  var nominatorAddressesChucked = []
  const numChunks = Math.ceil(nominatorAddresses.length / batchSize)
  for (let i = 0; i < nominatorAddresses.length; i += batchSize) {
    const chunk = nominatorAddresses.slice(i, i + batchSize)
    nominatorAddressesChucked.push(chunk)
  }
  var nominatorsStakings = []
  var idx = 0
  for (const chunk of nominatorAddressesChucked) {
    console.debug(`${++idx}/${numChunks} - the handled chunk size is ${chunk.length}`)
    // const accounts = await api.derive.staking.accounts(chunk)
    res = await axios.post(`${REST_API_BASE}/${CHAIN}/derive/staking/accounts`, { ids: chunk })
    const accounts = res?.data?.accounts || []
    // accounts.forEach((a) => {
    //   if (a) {
    //     nominatorsStakings.push({
    //       nextSessionIds: a.nextSessionIds,
    //       sessionIds: a.sessionIds,
    //       accountId: a.accountId.toHuman(),
    //       controllerId: a.controllerId.toHuman(),
    //       exposure: a.exposure.toJSON(),
    //       // nominators: a.nominators.toJSON(),
    //       targets: a.nominators?.toJSON() || [],
    //       rewardDestination: a.rewardDestination.toJSON(),
    //       validatorPrefs: a.validatorPrefs.toJSON(),
    //       redeemable: a.redeemable.toHuman(),
    //       unlocking: a.unlocking
    //     })
    //   }
    // })
    nominatorAddresses.push(...accounts)
    // console.debug(nominatorsStakings[0])
    // return nominatorsStakings
  }
  return nominatorsStakings
}

function calcValidatorNominators() {
  validator_nominators = {}
  nominators.forEach(n => {
    n.targets.forEach(t => {
      if (validator_nominators[t]) {
        if (!validator_nominators[t].includes(n.accountId)) {
          validator_nominators[t].push(n.accountId)
        }
      } else {
        validator_nominators[t] = [n.accountId]
      }
    })
  })
}

// GLOBALS ==========================================
var validators = [];
// var candidates = [];
var nominators = [];
var validator_nominators = {};
// prevent multiple concurrent executions
var is_running = false;

module.exports = async (event, context) => {

  await logger.debug(FUNCTION, event)

  // endpoints = await getEndpoints()
  // const provider = new WsProvider(endpoints[CHAIN][PROVIDER])
  // const api = await ApiPromise.create({ provider: provider })

  if (is_running) return context
    .status(200)
    .headers({ 'content-type': 'text/json' })
    .succeed({ warning: 'another update is already running' })

  is_running = true
  // prevent deadlock
  var tout = setTimeout(() => {
    is_running = false
  }, 10*60*1000) // 10 minutes

  var res
  var result

  try {
    // res = await axios.get(UPDATE_URL)
    // slog('getting candidates')
    // candidates = await getAllCandidates(CHAIN)
    // slog(`... found ${candidates.length}`)
    slog('getting nominators')
    nominators = await getAllNominators(128)
    slog(`... found ${nominators.length}`)
    slog('calc validator nominators')
    calcValidatorNominators()
    slog('getting validators')
    validators = await getAllValidators(128)
  } catch (err) {
    console.warn(`ERROR: ${FUNCTION}`)
    console.warn(err)
    await logger.error(FUNCTION, err)
  }

  const client = new MongoClient(MONGO_CONNECTION_URL)
  try {
    await client.connect()
    const database = client.db("mspn_io_api")
    const col = database.collection(MONGO_COLLECTION)
    validators.forEach(async (model) => {
      const query = {
        // _id: model._id,
        chain: CHAIN,
        stash: model.stash
      }
      model.chain = CHAIN
      model.updatedAt = moment().utc().format()
      const result = await col.replaceOne(query, model, { upsert: true })
    })
    result = {
      validators_updated: validators.length,
      validators: validators.map(n => { return { _id: n._id, stash: n.stash } }),
      // 'content-type': event.headers["content-type"]
      'content-type': 'application/json'
    }
  } catch (err) {
    console.warn(`ERROR: ${FUNCTION}`)
    console.warn(err)
    await logger.error(FUNCTION, err)
    result = {
      error: err,
      // 'content-type': event.headers["content-type"],
      'content-type': 'application/json'
    }
  // } finally {
  //   await client.close()
  }

  console.log('done')
  clearTimeout(tout)
  is_running = false

  return context
    .status(200)
    .headers({ 'content-type': 'text/json' })
    .succeed(result)

}
