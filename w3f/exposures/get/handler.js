'use strict'
const { MongoClient } = require('mongodb')

const CHAIN = process.env.CHAIN || 'kusama'

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`

const MONGO_COLLECTION = 'w3f_exposure'

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
      // expect /<stash> or /<stash>/<era>
      var [_, stash, era] = event.path.split('/')
      console.log('got', stash, era)
      if (!era) {
        var latest = await col.find({}).sort({era:-1}).limit(1).toArray()
        // console.log('latest', latest)
        era = latest[0].era
      }
      result = await col.findOne({ chain: CHAIN, era, stash }, projection)
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
