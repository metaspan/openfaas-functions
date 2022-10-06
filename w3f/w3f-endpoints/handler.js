'use strict'
const { MongoClient } = require('mongodb')

const { endpoints } = require('./endpoints.js')

// const fs = require('fs')
// const env = JSON.parse(fs.readFileSync('/var/openfaas/secrets/dotenv', 'utf-8'))
// const MONGO_HOST = env.MONGO_HOST
// const MONGO_PORT = env.MONGO_PORT
// const MONGO_USERID = env.MONGO_USERID
// const MONGO_PASSWD = env.MONGO_PASSWD
// const MONGO_DATABASE = env.MONGO_DATABASE
// const MONGO_CONNECTION_URL = `mongodb://${MONGO_USERID}:${MONGO_PASSWD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`
// const MONGO_COLLECTION = 'w3f_endpoint'
// var dbc
// const prepareDB = async function () {
//   // const url = "mongodb://" + process.env.mongo + ":27017/clients"
//   return new Promise((resolve, reject) => {
//     if(dbc) {
//       console.warn("DB already connected.")
//       return resolve(dbc)
//     }
//     console.warn("DB connecting")
//     MongoClient.connect(MONGO_CONNECTION_URL, (err, database) => {
//       if(err) {
//         return reject(err)
//       }
//       dbc = database.db(MONGO_DATABASE)
//       return resolve(dbc)
//     })
//   })
// }

module.exports = async (event, context) => {

  // const client = new MongoClient(MONGO_CONNECTION_URL)
  // var result = {}
  // try {
  //   await prepareDB()
  //   const col = dbc.collection(MONGO_COLLECTION)
  //   if (event.path === '/') {
  //     result = await col.find({}).project({_id: 0}).toArray()
  //     if (result.length === 0) result = endpoints
  //   } else {
  //     // expect /<chain> or /<chain>/<provider>
  //     var [_, chain, provider] = event.path.split('/')
  //     console.log('got', chain, provider)
  //     result = await col.findOne({ chain }, { projection: { _id: 0 } })
  //     console.log(result)
  //     if (!result) result = endpoints.find(f => f.chain === chain)
  //     if (provider) result = result.provider[provider]
  //   }
  // } catch (err) {
  //   console.error(err)
  //   result = {
  //     error: JSON.stringify(err),
  //   }
  // }

  return context
    .status(200)
    .headers({'content-type':'text/json'})
    .succeed(JSON.stringify(endpoints))

}
