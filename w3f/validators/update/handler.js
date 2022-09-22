'use strict'
const axios = require('axios')
const { ApiPromise, WsProvider } = require('@polkadot/api')
const { hexToString } = require('@polkadot/util')
const { endpoints } = require('./endpoints.js')

const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')
const { HTTPLogger } = require('./HTTPLogger')

const logger = new HTTPLogger({hostname: '192.168.1.82'})

const CHAIN = process.env.CHAIN || 'kusama'
const PROVIDER = process.env.PROVIDER || 'local'

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

async function getAllValidators (api, batchSize=256) {
  var ret = []
  // if (fs.existsSync(`${options.chain}-validators.json`)) {
  //   slog(`serving validators from ${options.chain}-validators.json`)
  //   return JSON.parse(fs.readFileSync(`${options.chain}-validators.json`, 'utf-8'))
  // }
  // @TODO - this only gets teh active validators...!!! better to get them from the list of nominators.
  // var validator_ids = await api.query.session.validators()
  // validator_ids = validator_ids.toJSON()
  var validator_ids = []
  for (var i = 0; i < nominators.length; i++) {
    const nom = nominators[i]
    for (var j = 0; j < nom.targets.length; j++) {
      validator_ids.push(nom.targets[j])
    }
  }
  validator_ids = [...new Set(validator_ids.sort())]
  // console.debug(validators.toJSON())
  // get any on-chain identities
  for(var i = 0; i < validator_ids.length; i += batchSize) {
    const ids = validator_ids.slice(i, i + batchSize)
    const identities = await api.query.identity.identityOf.multi(ids)
    // let test = {
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
    const prefs = await api.query.staking.validators.multi(ids)
    for (var j = 0; j < ids.length; j++) {
      // if('DSA55HQ9uGHE5MyMouE8Geasi2tsDcu3oHR4aFkJ3VBjZG5' === ids[j]) {
      ret.push({
        stash: ids[j], 
        shortStash: shortStash(ids[j]), 
        identity: parseIdentity(identities[j]),
        prefs: prefs[j].toJSON(),
        nominators: validator_nominators[ids[j]]
      })
    }
  }
  // fs.writeFileSync(`${options.chain}-validators.json`, JSON.stringify(ret, {}, 2), 'utf-8')
  return ret
}

async function getAllNominators (api, batchSize=256) {
  // if (fs.existsSync(`${options.chain}-nominators.json`)) {
  //   slog(`serving nominators from ${options.chain}-nominators.json`)
  //   return JSON.parse(fs.readFileSync(`${options.chain}-nominators.json`, 'utf-8'))
  // }
  const nominators = await api.query.staking.nominators.entries();
  const nominatorAddresses = nominators.map(([address]) => ""+address.toHuman()[0]);
  console.debug(`the nominator addresses size is ${nominatorAddresses.length}, working in chunks of ${batchSize}`)
  //A too big nominators set could make crush the API => Chunk splitting
  // const size = batchSize
  var nominatorAddressesChucked = []
  for (let i = 0; i < nominatorAddresses.length; i += batchSize) {
    const chunk = nominatorAddresses.slice(i, i + batchSize)
    nominatorAddressesChucked.push(chunk)
  } 
  var nominatorsStakings = []
  var idx = 0
  for (const chunk of nominatorAddressesChucked) {
    console.debug(`${++idx} - the handled chunk size is ${chunk.length}`)
    const accounts = await api.derive.staking.accounts(chunk)
    nominatorsStakings.push(...accounts.map(a => {
      return {
        nextSessionIds: a.nextSessionIds,
        sessionIds: a.sessionIds,
        accountId: a.accountId.toHuman(),
        controllerId: a.controllerId.toHuman(),
        exposure: a.exposure.toJSON(),
        // nominators: a.nominators.toJSON(),
        targets: a.nominators.toJSON(),
        rewardDestination: a.rewardDestination.toJSON(),
        validatorPrefs: a.validatorPrefs.toJSON(),
        redeemable: a.redeemable.toHuman(),
        unlocking: a.unlocking
      }
    }))
    // console.debug(nominatorsStakings[0])
    // return nominatorsStakings
  }
  // fs.writeFileSync(`${options.chain}-nominators.json`, JSON.stringify(nominatorsStakings, {}, 2), 'utf-8')
  return nominatorsStakings
}

function calcValidatorNominators(chain) {
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
  // fs.writeFileSync(`${DATA_DIR}/${chain}-validator-nominators.json`, JSON.stringify(validator_nominators, {}, 2), 'utf-8')
}

// GLOBALS ==========================================
var validators = [];
// var candidates = [];
var nominators = [];
var validator_nominators = {};

module.exports = async (event, context) => {

  await logger.debug(FUNCTION, event)

  const provider = new WsProvider(endpoints[CHAIN][PROVIDER])
  const api = await ApiPromise.create({ provider: provider })

  var res
  var result

  try {
    // res = await axios.get(UPDATE_URL)
    // slog('getting candidates')
    // candidates = await getAllCandidates(CHAIN)
    // slog(`... found ${candidates.length}`)
    slog('getting nominators')
    nominators = await getAllNominators(api, 512)
    slog(`... found ${nominators.length}`)
    slog('calc validator nominators')
    calcValidatorNominations()
    slog('getting validators')
    validators = await getAllValidators(api, 512)
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
    validators.forEach(async (nominator) => {
      const query = {
        _id: nominator._id,
        // stash: nominator.stash
      }
      nominator.chain = CHAIN
      nominator.updatedAt = moment().utc().format()
      const result = await col.replaceOne(query, nominator, { upsert: true })
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


  return context
    .status(200)
    .headers({ 'content-type': 'text/json' })
    .succeed(result)

}
