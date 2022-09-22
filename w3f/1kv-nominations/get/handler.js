'use strict'
const { MongoClient } = require('mongodb')

const CHAIN = process.env.CHAIN || 'kusama'

const MONGO_HOST = '192.168.1.2'
const MONGO_PORT = '32768'
const MONGO_USERID = 'mspn_io_api'
const MONGO_PASSWD = 'wordpass'
const MONGO_DATABASE = 'mspn_io_api'
const MONGO_COLLECTION = '1kv_nomination'
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
    if (event.path === '/') {
      result = await col.find({chain: CHAIN}, projection).toArray()
    } else {
      const stash = event.path.replace('/', '')
      result = await col.findOne({ chain: CHAIN, stash: stash }, projection)
    }
  } catch (err) {
    console.error(err)
    result = {
      error: JSON.stringify(err),
    }
  // } finally {
  //   client.close()
  }

  return context
    .status(200)
    .headers({'content-type':'text/json'})
    .succeed(JSON.stringify(result))

}
