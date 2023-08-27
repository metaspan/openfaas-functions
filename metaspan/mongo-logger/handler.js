'use strict'

const fs = require('fs')
const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))
console.log(env)
// require('dotenv').parse(env)

const axios = require('axios')
const moment = require('moment-timezone')
const { MongoClient } = require('mongodb')

const MONGO_HOST = env.MONGO_HOST
const MONGO_PORT = env.MONGO_PORT
const MONGO_USERID = env.MONGO_USERID
const MONGO_PASSWD = env.MONGO_PASSWD
const MONGO_DATABASE = env.MONGO_DATABASE
const MONGO_COLLECTION = env.MONGO_COLLECTION

const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`

// Database Pool Connection
var dbc

async function logEvent(event) {
  console.log(event)
}

const prepareDB = async function () {
  // const url = "mongodb://" + env.mongo + ":27017/clients"
  return new Promise((resolve, reject) => {
    if (dbc) {
      console.warn("DB already connected.")
      return resolve(dbc)
    }
    console.warn("DB connecting")
    MongoClient.connect(MONGO_CONNECTION_URL, (err, client) => {
      if (err) { return reject(err) }
      client.on('error', logEvent)
      client.on('connect', logEvent)
      client.on('disconnect', logEvent)
      client.on('reconnect', logEvent)
      dbc = client.db(MONGO_DATABASE)
      return resolve(dbc)
    })
  })
}

function slog (str) { console.log('mongo-logger: ' + str) }

module.exports = async (event, context) => {

  slog('starting...', event.path)
  const fn = event.path.replace('/', '')
  const data = event.body
  const level = event.query.level || 'info'
  var result

  try {
    await prepareDB()
    const col = dbc.collection(MONGO_COLLECTION)
    const record = {
      datetime: moment().utc().format(),
      level,
      function: fn,
      data
    }
    slog('inserting log record')
    result = await col.insertOne(record)
  } catch (err) {
    slog('got an error...!')
    console.error(err)
    result = {
      error: err
    }
  }
  slog('done...' + JSON.stringify(result))

  return context
    .status(200)
    .headers({'content-type': 'text/json'})
    .succeed(result)
}
