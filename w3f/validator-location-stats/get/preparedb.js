// ref: https://github.com/alexellis/mongodb-function/blob/master/insert-user/handler.js

const MongoClient = require('mongodb').MongoClient

/**
 * @param {*} dbc : database connection
 * @param {string} collection : collection name
 * @param {string} url : mongodb connection uri
 * @returns MongoDB Collection
 */
const prepareDB = async function (dbc, collection, url) {
  // const url = "mongodb://" + process.env.mongo + ":27017/clients"

  return new Promise((resolve, reject) => {
    if(dbc) {
      console.warn("DB already connected.")
      return resolve(dbc)
    }

    console.warn("DB connecting")

    MongoClient.connect(url, (err, database) => {
      if(err) {
        return reject(err)
      }

      const _dbc = database.db(collection)
      return resolve(_dbc)
    })
  })
}

// export { prepareDB }
