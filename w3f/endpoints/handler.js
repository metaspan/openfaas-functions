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

const MONGO_COLLECTION = 'w3f_endpoint'

var dbc

module.exports = async (event, context) => {

  const client = new MongoClient(MONGO_CONNECTION_URL)
  var result = {}

  try {
    await prepareDB()
    const col = dbc.collection(MONGO_COLLECTION)
    if (event.path === '/') {
      result = await col.find({}).toArray()
    } else {
      // expect /<chain> or /<chain>/<provider>
      var [_, chain, provider] = event.path.split('/')
      console.log('got', chain, provider)
      var crit = { chain }
      result = await col.findOne({ chain })
      if (provider) result = result[provider]
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
