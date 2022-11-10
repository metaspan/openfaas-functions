'use strict'
const { MongoClient } = require('mongodb')

const CHAIN = process.env.CHAIN || 'kusama'

const MONGO_HOST = '192.168.1.2'
const MONGO_PORT = '32768'
const MONGO_USERID = 'mspn_io_api'
const MONGO_PASSWD = 'wordpass'
const MONGO_DATABASE = 'mspn_io_api'
const MONGO_COLLECTION = '1kv_candidate'
const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`

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

module.exports = async (event, context) => {

  const client = new MongoClient(MONGO_CONNECTION_URL)
  var result = {}

  try {
    // await client.connect()
    // const dbc = client.db("mspn_io_api")
    await prepareDB()
    const col = dbc.collection(MONGO_COLLECTION)
    const projection = { chain: 0 } // exclude chain field from result
    const latest = await dbc.collection('1kv_nomination').find({ chain: CHAIN }).sort({ era: -1 }).limit(1).toArray()
    console.log('latest', latest)
    if (event.path === '/') {
      result = await col.find({chain: CHAIN}, projection).toArray()
      for (var i = 0; i < result.length; i++) {
        const crit = { chain: CHAIN, era: latest[0].era, validators: result[i].stash }
        const noms = await dbc.collection('1kv_nomination').count(crit)
        result[i].nominated_1kv = noms > 0  
      }
    } else {
      const stash = event.path.replace('/', '')
      result = await col.findOne({ chain: CHAIN, stash: stash }, projection)
      // const ids = result.map(r => r.stash)
      const crit = { chain: CHAIN, era: latest[0].era, validators: stash }
      const noms = await dbc.collection('1kv_nomination').count(crit)
      result.nominated_1kv = noms > 0
    }
  } catch (err) {
    console.error(err)
    result = {
      error: JSON.stringify(err),
    }
  }

  return context
    .status(200)
    .headers({'content-type':'text/json'})
    .succeed(JSON.stringify(result))

}
