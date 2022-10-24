'use strict'
const axios = require('axios')
const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')
const { HTTPLogger } = require('./HTTPLogger')

const LOGGER_HOST = process.env.LOGGER_HOST || 'gateway'
const LOGGER_PORT = process.env.LOGGER_PORT || 8080
const logger = new HTTPLogger({hostname: LOGGER_HOST, port: LOGGER_PORT})

const CHAIN = process.env.CHAIN || 'kusama'
const UPDATE_URL = `https://${CHAIN}.w3f.community/nominations`

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_COLLECTION = '1kv_nomination'
const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`

module.exports = async (event, context) => {

  await logger.debug(`w3f-1kv-nominations-${CHAIN}-update`, event)

  const res = await axios.get(UPDATE_URL)
  var result

  if (res.data) {
    const nominations = res.data
    // update the db
    const client = new MongoClient(MONGO_CONNECTION_URL)
    try {
      await client.connect()
      const database = client.db(MONGO_DATABASE)
      const col = database.collection(MONGO_COLLECTION)
      nominations.forEach(async (nomination) => {
        const query = {
          _id: nomination._id,
          // stash: nomination.stash
        }
        nomination.chain = CHAIN
        nomination.updatedAt = moment().utc().format()
        const result = await col.replaceOne(query, nomination, { upsert: true })
      })
      result = {
        nominations_updated: nominations.length,
        nominations: nominations.map(n => { return { _id: n._id, stash: n.stash } }),
        // 'content-type': event.headers["content-type"]
        'content-type': 'application/json'
      }
    } catch (err) {
      await logger.error(`1kv-nominations-${CHAIN}-update`, err)
      result = {
        error: err,
        // 'content-type': event.headers["content-type"],
        'content-type': 'application/json'
      }
    // } finally {
    //   await client.close()
    }

  } else {
    result = {
      'body': JSON.stringify(event.body),
      // 'content-type': event.headers["content-type"]
      'content-type': 'application/json'
    }
  }

  return context
    .status(200)
    .succeed(result)

}
