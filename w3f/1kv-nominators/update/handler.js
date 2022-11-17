'use strict'
const axios = require('axios')
const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')
const { HTTPLogger } = require('./HTTPLogger')

const LOGGER_HOST = process.env.LOGGER_HOST || 'gateway'
const LOGGER_PORT = process.env.LOGGER_PORT || 8080
const logger = new HTTPLogger({hostname: LOGGER_HOST, port: LOGGER_PORT})

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))

const CHAIN = process.env.CHAIN || 'kusama'
const UPDATE_URL = `https://${CHAIN}.w3f.community/nominators`

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_COLLECTION = '1kv_nominator'
const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`
const FUNCTION = `w3f-1kv-nominators-${CHAIN}-update`

module.exports = async (event, context) => {

  await logger.debug(FUNCTION, event)
  var res = await axios.get(`http://192.168.1.2:1880/job-log?host=gateway&name=function:${FUNCTION}&action=start`)
  const { id } = res.data

  var result

  try {
    res = await axios.get(UPDATE_URL)
  } catch (err) {
    await logger.error(FUNCTION, err)
  }

  if (res.data) {
    const nominators = res.data
    // update the db
    const client = new MongoClient(MONGO_CONNECTION_URL)
    try {
      await client.connect()
      const database = client.db("mspn_io_api")
      const col = database.collection(MONGO_COLLECTION)
      nominators.forEach(async (nominator) => {
        const query = {
          _id: nominator._id,
          // stash: nominator.stash
        }
        nominator.chain = CHAIN
        nominator.updatedAt = moment().utc().format()
        const result = await col.replaceOne(query, nominator, { upsert: true })
      })
      result = {
        nominators_updated: nominators.length,
        nominators: nominators.map(n => { return { _id: n._id, stash: n.stash } }),
        // 'content-type': event.headers["content-type"]
        'content-type': 'application/json'
      }
    } catch (err) {
      await logger.error(FUNCTION, err)
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

  await axios.get(`http://192.168.1.2:1880/job-log?id=${id}&action=stop`)

  return context
    .status(200)
    .headers({ 'content-type': 'text/json' })
    .succeed(result)

}
