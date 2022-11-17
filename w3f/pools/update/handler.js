'use strict'
const axios = require('axios')
// const { ApiPromise, WsProvider } = require('@polkadot/api')
// const { hexToString } = require('@polkadot/util')
// // const { endpoints } = require('./endpoints.js')
// var endpoints = {}

const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')
const { HTTPLogger } = require('./HTTPLogger')

const LOGGER_HOST = process.env.LOGGER_HOST || 'gateway' // '192.168.1.91' // 'localhost'
const LOGGER_PORT = process.env.LOGGER_PORT || 8080
const logger = new HTTPLogger({hostname: LOGGER_HOST, port: LOGGER_PORT})

const CHAIN = process.env.CHAIN || 'kusama'
const PROVIDER = process.env.PROVIDER || 'local'
const REST_API_BASE = process.env.REST_API_BASE || 'http://192.168.1.92:3000'

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_COLLECTION = 'w3f_pool'
const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`

const FUNCTION = `w3f-pools-${CHAIN}-update`

function slog(text) {
  console.log(text)
}

// async function getEndpoints () {
//   const res = await axios.get('http://api.metaspan.io/function/w3f-endpoints')
//   console.log('getEndpoints()', JSON.stringify(res.data))
//   return res.data
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
// async function getAllPools (api) {
async function getAllPools () {
  slog(`getAllPools(): ${CHAIN}`)
  var ret = []
  // // var entries = await api.query.nominationPools.poolMembers.entries()
  // var res = await axios.get('${REST_API_BASE}/${CHAIN}/query/nominationPools/poolMembers')
  // // var entries = res.data || []
  // // // console.log('num entries', entries.length)
  // // var poolMembers = entries.reduce((all, [{ args: [accountId] }, optMember]) => {
  // //   if (optMember.isSome) {
  // //     const member = optMember.unwrap()
  // //     const poolId = parseInt(member.poolId.toString())
  // //     if (!all[poolId]) {
  // //       all[poolId] = []
  // //     }
  // //     // all[poolId].push({
  // //     //   accountId: accountId.toString(),
  // //     //   member
  // //     // });
  // //     all[poolId].push(accountId.toString())
  // //   }
  // //   return all
  // // }, {})
  // var poolMembers = res?.data?.poolMembers || []

  // var lastId = await api.query.nominationPools.lastPoolId()
  var res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/nominationPools/lastPoolId`)
  var lastId = res?.data?.lastPoolId || 0
  for (var pid = 1; pid <= lastId; pid++) {
    slog(`pool ${pid} =====================`)
    var pool = { id: pid }

    // var example = {
    //   "points":1999966666667,
    //   "state":"Open",
    //   "memberCounter":1,
    //   "roles":{
    //     "depositor":"Ghekn7fgaxi7GX7ty547qt81vo6m3V735dCF5WgJ3ZE5vfb",
    //     "root":"Ghekn7fgaxi7GX7ty547qt81vo6m3V735dCF5WgJ3ZE5vfb",
    //     "nominator":"Ghekn7fgaxi7GX7ty547qt81vo6m3V735dCF5WgJ3ZE5vfb",
    //     "stateToggler":"Ghekn7fgaxi7GX7ty547qt81vo6m3V735dCF5WgJ3ZE5vfb"
    //   }
    // }
    // var bondedPools = await api.query.nominationPools.bondedPools(pid)
    // bondedPools = bondedPools.toJSON()
    res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/nominationPools/bondedPools?id=${pid}`)
    var bondedPools = res?.data?.bondedPools || {}
    pool.points = bondedPools?.points || 0
    pool.state = bondedPools?.state || 'Destroyed'
    pool.memberCounter = bondedPools?.memberCounter || 0
    pool.roles = bondedPools?.roles || {}
    // console.log(pool.bondedPools)

    // pool name is in the meta
    // pool.name = await api.query.nominationPools.metadata(pid)
    // pool.name = hexToString(pool.name.toString())
    res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/nominationPools/metadata?id=${pid}`)
    pool.name = res?.data?.metadata || ''
    // console.log(pool.name)

    // {balance: 0, totalEarnings: 0, points: 0}
    // var rewardPools = await api.query.nominationPools.rewardPools(pid)
    // rewardPools = rewardPools.toJSON()
    res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/nominationPools/metadata?id=${pid}`)
    var rewardPools = res?.data?.rewardPools || {}
    pool.balance = rewardPools?.balance || 0
    pool.totalEarnings = rewardPools?.totalEarnings || 0
    // pool.points = rewardPools.points
    // console.log(pool.rewardPools)

    pool.members = members[pool.id]
    // console.log(pool.members)

    // pool.subPoolStorage = await api.query.nominationPools.subPoolsStorage(pid)
    // pool.subPoolStorage = pool.subPoolStorage.toJSON()
    res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/nominationPools/subPoolsStorage?id=${pid}`)
    pool.subPoolsStorage = res?.data?.subPoolsStorage || {}

    ret.push(pool)
  }
  return ret
}


// GLOBALS ==========================================
var pools = [];
var members = [];

module.exports = async (event, context) => {

  await logger.debug(FUNCTION, event)
  var res = await axios.get(`http://gateway:8080/function/job-log-update?host=gateway&name=function:${FUNCTION}&action=start`)
  const { id } = res.data

  // endpoints = await getEndpoints()
  // const provider = new WsProvider(endpoints[CHAIN][PROVIDER])
  // const api = await ApiPromise.create({ provider: provider })

  var result

  try {
    // res = await axios.get(UPDATE_URL)
    // slog('getting candidates')
    // candidates = await getAllCandidates(CHAIN)
    // slog(`... found ${candidates.length}`)
    slog('getting members')
    // var entries = await api.query.nominationPools.poolMembers.entries()
    res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/nominationPools/poolMembers`)
    members = res?.data?.poolMembers || {}
    // // console.log('num entries', entries.length)
    // members = entries.reduce((all, [{ args: [accountId] }, optMember]) => {
    //   if (optMember.isSome) {
    //     const member = optMember.unwrap();
    //     const poolId = member.poolId.toNumber() // toString();
    //     if (!all[poolId]) { all[poolId] = []; }
    //     all[poolId].push({
    //       accountId: accountId.toString(),
    //       points: member.points.toNumber()
    //       // member
    //     });
    //     // all[poolId].push(accountId.toString());
    //   }
    //   return all;
    // }, {})
    slog('getting pools')
    // pools = await getAllPools(api)
    pools = await getAllPools()
    slog(`... found ${pools.length}`)
  } catch (err) {
    console.warn(`ERROR: ${FUNCTION}`)
    console.warn(err)
    await logger.error(FUNCTION, err)
  }

  const client = new MongoClient(MONGO_CONNECTION_URL)
  try {
    await client.connect()
    const database = client.db(MONGO_DATABASE)
    const col = database.collection(MONGO_COLLECTION)
    // pools.forEach(async (pool) => {
    for(var i = 0; i < pools.length; i++) {
      const pool = pools[i]
      const query = {
        id: pool.id,
        // stash: pool.stash
      }
      pool.chain = CHAIN
      pool.members = members[pool.id]
      pool.updatedAt = moment().utc().format()
      const result = await col.replaceOne(query, pool, { upsert: true })
    }
    result = {
      pools_updated: pools.length,
      pools: pools.map(n => { return { id: n.id, name: n.name } }),
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
  } finally {
    try { await client.close() } catch {}
    // try { await api.disconnect() } catch {}
  }

  await axios.get(`http://gateway:8080/function/job-log-update?id=${id}&action=stop`)

  return context
    .status(200)
    .headers({ 'content-type': 'text/json' })
    .succeed(result)

}
