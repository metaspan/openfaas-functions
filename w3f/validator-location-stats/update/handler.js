'use strict'
const axios = require('axios')
const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')

const CHAIN = process.env.CHAIN || 'kusama'
const UPDATE_URL = `https://${CHAIN}.w3f.community/locationstats`

const MONGO_HOST = '192.168.1.2'
const MONGO_PORT = '32768'
const MONGO_USERID = 'mspn_io_api'
const MONGO_PASSWD = 'wordpass'
const MONGO_DATABASE = 'mspn_io_api'
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
      const database = client.db("mspn_io_api")
      const col = database.collection("w3f_location_stats")
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
