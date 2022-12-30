'use strict'

// import axios from 'axios'
import moment from 'moment'
import { createUrl, prepareDB, closeDB, getAllNominators } from './utils.js'

function slog (str) { console.log('w3f-exposures:' + str) }

export async function f_w3f_nominators_update (job) {
  // WARNING, this could print the db password!
  // console.log(job.data);

  const { MONGO_DATABASE } = process.env
  const { CHAIN } = job.data
  const MONGO_COLLECTION = 'w3f_nominator'
  const MONGO_CONNECTION_URL = createUrl()

  var dbc
  var result
  var nominators = []

  try {
    nominators = await getAllNominators(CHAIN, 128)
  } catch (err) {
    console.error(err)
    // await logger.error(FUNCTION, err)
  }

  console.debug('updating database...')
  try {
    dbc = await prepareDB(MONGO_CONNECTION_URL, MONGO_DATABASE)
    const col = dbc.collection(MONGO_COLLECTION)
    nominators.forEach(async (nominator) => {
      const query = {
        chain: CHAIN,
        accountId: nominator.accountId,
      }
      nominator.chain = CHAIN
      nominator.updatedAt = moment().utc().format()
      const result = await col.replaceOne(query, nominator, { upsert: true })
    })
    result = {
      nominators_updated: nominators.length,
      nominators: nominators.map(n => { return { _id: n._id, accountId: n.accountId } }),
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
  }

  console.log('w3f-nominators-update done...', CHAIN)
  return result
}
