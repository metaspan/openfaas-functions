'use strict'

const { default: axios } = require('axios')
/*
  1KV Prometheus Exporter
*/

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))
console.log(env)

const { MongoClient } = require('mongodb')

const CHAIN = process.env.CHAIN || 'kusama'

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_COLLECTION = '1kv_nominator'
const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`
const TOKENS = {
  kusama: 'KSM',
  polkadot: 'DOT'
}
const PREFIX = `${TOKENS[CHAIN].toLowerCase()}_1kv`

var dbc

const prepareDB = async function () {
  // const url = "mongodb://" + process.env.mongo + ":27017/clients"
  return new Promise((resolve, reject) => {
    if(dbc) {
      console.warn("DB already connected.")
      return resolve(dbc)
    }
    console.warn("DB connecting")
    MongoClient.connect(MONGO_CONNECTION_URL, (err, database) => {
      if(err) {
        return reject(err)
      }
      dbc = database.db(MONGO_DATABASE)
      return resolve(dbc)
    })
  })
}

// total score needs to be recalculated
function calculateScore (score) {
  var total = 0.0
  var items = []
  if (!score) return items
  const randomness = score.randomness
  delete score.randomness
  Object.keys(score).forEach((key) => {
    // console.log('checking ' + key)
    if (!['_id',
      'updated',
      'address',
      '__v',
      'total',
      'aggregate',
      'randomness',
      'session'
    ].includes(key)) {
      total += score[key]
      items.push(`${PREFIX}_score{category="${key}", stash="${score.address}"} ${score[key]}`)
    }
  })
  const aggregate = total * (100 + randomness)/100
  items.push(`${PREFIX}_score{category="total", stash="${score.address}"} ${total}`)
  items.push(`${PREFIX}_score{category="aggregate", stash="${score.address}"} ${aggregate}`)
  // console.log('items', items)
  return items
}

const decimals = {
  0:  1,
  1:  10,
  2:  100,
  3:  1000,
  4:  10000,
  5:  100000,
  6:  1000000,
  7:  10000000,
  8:  100000000,
  9:  1000000000,
  10: 10000000000,
  11: 100000000000,
  12: 1000000000000,
}
async function getChainProperties() {
  var res = await axios.get(`http://192.168.1.92:3000/${CHAIN}/rpc/system/properties`)
  var properties = res.data || { tokenDecimals: 0, tokenSymbol: '' }
  return properties
}

async function getBalances(ids = [], batchSize=125) {
  console.debug('getBalances()', ids)
  const accounts = []
  for(var i = 0; i <= ids.length; i += batchSize) {
    console.debug(`-- getting batch ${i}`)
    const batch = ids.slice(i, i + batchSize)
    const res = await axios.get(`http://192.168.1.92:3000/${CHAIN}/query/system/accountMulti`, { params: { ids: batch }})
    accounts.push(...res.data || [])
  }
  const free = accounts.reduce((current, account, idx) => { return current + BigInt(account.data.free) || BigInt(0) }, BigInt(0))
  const reserved = accounts.reduce((current, account, idx) => { return current + BigInt(account.data.reserved) || BigInt(0) }, BigInt(0))
  const miscFrozen = accounts.reduce((current, account, idx) => { return current + BigInt(account.data.miscFrozen) || BigInt(0) }, BigInt(0))
  const feeFrozen = accounts.reduce((current, account, idx) => { return current + BigInt(account.data.feeFrozen) || BigInt(0) }, BigInt(0))
  return { free, reserved, miscFrozen, feeFrozen }
}

module.exports = async (event, context) => {

  // expect /metrics/:stash
  const stash = event.path.replace('/metrics/', '')
  if (stash === undefined || stash === "") {
    return context
      .status(200)
      .headers({'content-type':'text/plain; charset=utf-8'})
      .succeed('invalid stash')
  }
  console.log('chain', CHAIN, 'stash:', stash)

  var result = ''

  await prepareDB()

  const chainProperties = await getChainProperties()

  const latest = await dbc.collection('1kv_nomination').find({ chain: CHAIN }).sort({ era: -1 }).limit(1).toArray()
  // TODO get the current era from REST
  const projection = { chain: 0 } // exclude chain field from result
  // const nominators_1kv = await dbc.collection('1kv_nominator').find({chain: CHAIN, 'current.stash': stash}, {projection}).toArray()
  // const nomination_1kv = await dbc.collection('1kv_nomination').find({ chain: CHAIN, validators: stash }).toArray()
  const nominator_1kv = await dbc.collection('1kv_nominator').find({ chain: CHAIN, 'current.stash': stash }).toArray()
  const nominators = await dbc.collection('w3f_nominator').find({chain: CHAIN, nominators: stash}, {projection}).toArray()
  // console.log('nominators_1kv', nominators_1kv)
  var candidate = await dbc.collection('1kv_candidate').findOne({chain: CHAIN, stash: stash})
  // var validator = await dbc.collection('w3f_validator').findOne({chain: CHAIN, stash: stash})
  // console.log('candidate:', candidate)

  if (!candidate) {
    return context
      .status(404)
      .headers({'content-type':'text/plain; charset=utf-8'})
      .succeed('invalid candidate stash '+stash)
  }

  const checkNominated = () => {
    // // specifically, 1kv nominators
    // // get all nominations
    // var nominated = []
    // nominators_1kv.forEach((nominator) => {
    //   nominator.current.forEach(current => {
    //     nominated.push(current.stash)
    //   })
    // })
    // nominated = [...new Set(nominated)].sort()
    // // this.candidates.forEach( async(candidate, cidx) => {
    // candidate.nominated_1kv = false
    // //   // this.candidates[cidx].nominators = []
    // if (nominated.includes(candidate.stash)) {
    //   candidate.nominated_1kv = true
    // }
    // // })
    // candidate.nominated_1kv = nomination_1kv.length > 0
    candidate.nominated_1kv = nominator_1kv.length > 0
    // console.debug('nominated:', nominated)
  }

  // cross-check valid with validity
  const checkValid = (valid, validity) => {
    // console.log('checkValidity', valid, validity)
    return valid
      ? valid
      : validity.filter(f => f.valid === false).length === 0
  }

  var items = []
  // items.push(`${PREFIX}_updated_at{stash="${stash}"} ${this.updatedAt.valueOf()}`)
  items.push(`${PREFIX}_rank{stash="${stash}"} ${candidate.rank}`)
  items.push(`${PREFIX}_active{stash="${stash}"} ${candidate.active ? 1 : 0}`)
  checkNominated()
  items.push(`${PREFIX}_nominated_1kv{stash="${stash}"} ${candidate.nominated_1kv ? 1 : 0}`)
  items.push(`${PREFIX}_nominator_count{stash="${stash}"} ${nominators.length}`)
  // TODO: find out why FNPCfXrsrA8775HGuRvK9seULKpcnxNTTKTGUL4h267YHvw is not in w3f_validators...?
  // var nom_bals = getBalances(validator.nominators)
  const denom = BigInt(decimals[chainProperties.tokenDecimals[0]])
  var { free, reserved, miscFrozen, feeFrozen } = await getBalances(nominators.map(n => n.accountId))
  items.push(`${PREFIX}_nominator_balances_free{stash="${stash}", symbol="${chainProperties.tokenSymbol[0]}"} ${free/denom}`)
  items.push(`${PREFIX}_nominator_balances_reserved{stash="${stash}", symbol="${chainProperties.tokenSymbol[0]}"} ${reserved/denom}`)
  items.push(`${PREFIX}_nominator_balances_misc_frozen{stash="${stash}", symbol="${chainProperties.tokenSymbol[0]}"} ${miscFrozen/denom}`)
  items.push(`${PREFIX}_nominator_balances_fee_frozen{stash="${stash}", symbol="${chainProperties.tokenSymbol[0]}"} ${feeFrozen/denom}`)
  items.push(`${PREFIX}_valid{stash="${stash}"} ${checkValid(candidate.valid, candidate.validity) ? 1 : 0}`)
  candidate.validity.forEach(v => {
    items.push(`${PREFIX}_validity{stash="${stash}", type="${v.type}"} ${v.valid ? 1 : 0}`)
  })
  // Object.keys(candidate.score).forEach(k => {
  //   // this.slog(`checking key ${k}`)
  //   if (!['_id', 'address', 'stash', '__v'].includes(k)) {
  //     items.push(`${PREFIX}_score{category="${k}", stash="${stash}"} ${candidate.score[k]}`)
  //   }
  // })
  // this.slog(`${candidate.stash}: score.location: ${candidate.score.location}`)
  const scoreItems = calculateScore(candidate.score)
  items = items.concat(scoreItems)
  result = items.join("\n")

  return context
    .status(200)
    .headers({'content-type':'text/plain; charset=utf-8'})
    .succeed(result)

}
