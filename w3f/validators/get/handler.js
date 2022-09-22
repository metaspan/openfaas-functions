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
const MONGO_COLLECTION = 'w3f_validator'
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
  // var count = 0
  const offset = parseInt(event.query.offset || 0)
  const limit = Math.min(50, parseInt(event.query.limit || 50))
  const search = event.query.search || undefined
  const sortBy = event.query.sortBy || 'name'
  const sortDir = event.query.sortDir || 'asc'

  try {
    // await client.connect()
    // const dbc = client.db("mspn_io_api")
    await prepareDB()
    const col = dbc.collection(MONGO_COLLECTION)
    const projection = { chain: 0 } // exclude chain field from result
    if (event.path === '/') {
      result.offset = offset
      result.limit = limit
      result.chain = CHAIN
      result.search = search || ''
      result.sortBy = sortBy
      result.sortDir = sortDir
      var crit = { chain: CHAIN }
      // if (search) crit['$or'] = {
      //   name: {'$regex': `/${search}/i`},
      //   stash: {'$regex': `/${search}/i`}
      // }
      if (search) {
        const regex = new RegExp(search, 'i');
        crit.name = {'$regex': regex}
      }
      result.count = await col.count(crit)
      var sortSpec = {}; sortSpec[sortBy] = sortDir === 'asc' ? 1 : -1
      result.list = await col.find(crit, projection).sort(sortSpec).skip(offset).limit(limit).toArray()
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
