'use strict'
const axios = require('axios')
const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')

const CHAIN = process.env.CHAIN || 'kusama'
const UPDATE_URL = `https://${CHAIN}.w3f.community/locationstats`

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_COLLECTION = 'w3f_location_stats'
const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`

module.exports = async (event, context) => {

  const res = await axios.get(UPDATE_URL)
  var result

  if (res.data) {
    const locations = res.data.locations
    // update the db
    const client = new MongoClient(MONGO_CONNECTION_URL)
    try {
      await client.connect()
      const database = client.db(MONGO_DATABASE)
      const col = database.collection(MONGO_COLLECTION)
      locations.forEach(async (location) => {
        const query = {
          _id: location._id,
          // stash: location.stash
        }
        location.chain = CHAIN
        location.updatedAt = moment().utc().format()
        const result = await col.replaceOne(query, location, { upsert: true })
      })
      result = {
        locations_updated: locations.length,
        locations: locations,
        'content-type': event.headers["content-type"]
      }
    } catch (err) {
      result = {
        error: err,
        'content-type': event.headers["content-type"]
      }
    // } finally {
    //   await client.close()
    }

  } else {
    result = {
      'body': JSON.stringify(event.body),
      'content-type': event.headers["content-type"]
    }
  }

  return context
    .status(200)
    .succeed(result)

}
