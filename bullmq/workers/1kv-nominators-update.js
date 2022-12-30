'use strict'

import axios from 'axios'
import moment from 'moment'
import { createUrl, prepareDB, closeDB } from './utils.js'

function slog (str) { console.log('1kv-nominators:' + str) }

// const worker = new Worker('1kv-candidates-update', async job => {
export async function f_1kv_nominators_update (job) {
  // Will print { foo: 'bar'} for the first job
  // and { qux: 'baz' } for the second.
  console.log(job.data);

  const { MONGO_DATABASE } = process.env
  const { CHAIN } = job.data
  const MONGO_COLLECTION = '1kv_nominator'
  const UPDATE_URL = `https://${CHAIN}.w3f.community/nominators`
  console.log('update url:', UPDATE_URL)
  const MONGO_CONNECTION_URL = createUrl()
  // const FUNCTION = `w3f-1kv-nominations-${CHAIN}-update`

  var dbc
  var res
  var result

  try {
    res = await axios.get(UPDATE_URL)
  } catch (err) {
    console.error(err)
    // await logger.error(FUNCTION, err)
    job.log('ERROR')
    job.log(err)
  }

  if (res && res.data) {
    const nominators = res.data
    // update the db
    try {
      dbc = await prepareDB(MONGO_CONNECTION_URL, MONGO_DATABASE)
      const col = dbc.collection(MONGO_COLLECTION)
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
        'content-type': 'application/json'
      }
    } catch (err) {
      console.error(err)
      // await logger.error(FUNCTION, err)
      // result = {
      //   error: err,
      //   'content-type': 'application/json'
      // }
    // } finally {
    //   await client.close()
    }
  } else {
    slog('res.data was empty')
    result = {
      reason: 'res.data was empty',
      'body': JSON.stringify(event.body),
    }
  }
  console.log('1kv-nominators-update done...', CHAIN)

}
