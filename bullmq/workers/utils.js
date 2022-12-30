import { MongoClient } from "mongodb"
import axios from "axios"

var _client
var _dbc

const REST_API_BASE = 'http://192.168.1.92:3000'

function slog(text) {
  console.debug(text)
}

const createUrl = function () {
  const { MONGO_HOST, MONGO_PORT, MONGO_USERID, MONGO_PASSWD, MONGO_DATABASE } = process.env
  var url = 'mongodb://'
  if (MONGO_USERID) url += `${MONGO_USERID}:${MONGO_PASSWD}@`
  url += `${MONGO_HOST}:${MONGO_PORT}`
  if (MONGO_DATABASE) url += `/${MONGO_DATABASE}`
  return url
}

const prepareDB = async function (url, MONGO_DATABASE) {
  console.debug('prepareDB()')
  // const url = "mongodb://" + process.env.mongo + ":27017/clients"
  return new Promise((resolve, reject) => {
    if (_dbc) {
      console.warn("DB already connected.")
      return resolve(_dbc)
    }
    console.warn("DB connecting")
    // MongoClient.
    MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
      if (err) { return reject(err) }
      // client.on('error', logEvent)
      // client.on('connect', logEvent)
      // client.on('disconnect', logEvent)
      // client.on('reconnect', logEvent)
      _client = client
      _dbc = client.db(MONGO_DATABASE)
      return resolve(_dbc)
    })
  })
}

const closeDB = async function () {
  console.debug('closeDB()')
  if (_client) {
    await _client.close()
    _client = undefined
    _dbc = undefined
  }
}

const getAllExposures = async function (CHAIN) {
  var res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/staking/activeEra`)
  var activeEra = res?.data?.activeEra || 0
  // console.log(activeEra)
  res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/staking/erasStakers?index=${activeEra.index}`)
  console.debug(res.data)
  return res?.data?.erasStakers || []
}

async function getAllNominators (CHAIN='kusama', batchSize=256) {
  console.debug('getAllNominators', CHAIN, batchSize)
  let res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/staking/nominators`)
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
    res = await axios.post(`${REST_API_BASE}/${CHAIN}/derive/staking/accounts`, { ids: chunk })
    const accounts = res?.data?.accounts || []
    nominatorsStakings.push(...accounts)
  }
  return nominatorsStakings
}

async function getAllPools (CHAIN) {
  slog(`getAllPools(): ${CHAIN}`)
  var ret = []
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

async function getAllValidators (CHAIN, validator_nominators, batchSize=256) {

  const res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/staking/validators`)
  var vals = res?.data?.validators || []
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
      vals[i+j].shortStash = shortStash(ids[j])
      // vals[i+j].identity = parseIdentity(identities[j])
      vals[i+j].identity = identities[j]
      vals[i+j].nominators = validator_nominators[ids[j]]
    }
  }
  return vals
}

async function asyncForEach(array, callback) {  
  for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array)
  }
}

export {
  createUrl,
  prepareDB,
  closeDB,
  getAllExposures,
  getAllNominators,
  getAllPools,
  getAllValidators,
  asyncForEach
}
