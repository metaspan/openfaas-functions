'use strict'
const { MongoClient } = require('mongodb')
const fs = require('fs')

const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))

const CHAIN = process.env.CHAIN || 'kusama'

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
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
    if (event.path === '/') {
      result = await col.find({chain: CHAIN}, projection).toArray()
      result = result.map(m => {
        var score = m.score ? m.score : {}
        score.stash = m.stash
        return score
      })
    } else {
      const stash = event.path.replace('/', '')
      const validator = await col.findOne({ chain: CHAIN, stash: stash }, projection)
      result = validator.score
      result.stash = stash
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
