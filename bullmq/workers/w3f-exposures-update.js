'use strict'

// import axios from 'axios'
import moment from 'moment'
import { createUrl, prepareDB, closeDB, getAllExposures } from './utils.js'

function slog (str) { console.log('w3f-exposures:' + str) }

export async function f_w3f_exposures_update (job) {
  // WARNING, this could print the db password!
  // console.log(job.data);

  const { MONGO_DATABASE } = process.env
  const { CHAIN } = job.data
  const MONGO_COLLECTION = 'w3f_exposure'
  const MONGO_CONNECTION_URL = createUrl()

  var dbc
  var result

  const exposures = await getAllExposures(CHAIN)
  console.debug('# exposures', exposures.length)

  // update the db
  try {
    dbc = await prepareDB(MONGO_CONNECTION_URL, MONGO_DATABASE)
    const col = dbc.collection(MONGO_COLLECTION)
    exposures.forEach(async (exposure) => {
      // slog(`updating ${exposure.stash}`)
      // console.log(exposure)
      const query = {
        // _id: validator._id,
        era: exposure.era,
        stash: exposure.stash,
        chain: exposure.chain
      }
      // exposure.chain = CHAIN
      exposure.updatedAt = moment().utc().format()
      result = await col.replaceOne(query, exposure, { upsert: true })
      console.debug('result', result)
    })
    result = {
      exposures_updated: exposures.length,
      exposures: exposures.map(n => { return { _id: n._id, stash: n.stash } }),
      'content-type': 'application/json'
    }
  } catch (err) {
    console.error(err)
    // await logger.error(`1kv-exposures-${CHAIN}-update`, err)
    // result = {
    //   error: err,
    //   'content-type': 'application/json'
    // }
  }
  console.log('w3f-exposures-update done...', CHAIN)

}
