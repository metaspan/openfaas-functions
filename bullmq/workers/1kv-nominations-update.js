'use strict'

import axios from 'axios'
import moment from 'moment'
import { createUrl, prepareDB, closeDB } from './utils.js'

function slog (str) { console.log('1kv-nominations:' + str) }

// const worker = new Worker('1kv-candidates-update', async job => {
export async function f_1kv_nominations_update (job) {
  // Will print { foo: 'bar'} for the first job
  // and { qux: 'baz' } for the second.
  console.log(job.data);

  const { MONGO_DATABASE } = process.env
  const { CHAIN } = job.data
  const MONGO_COLLECTION = '1kv_nomination'
  const UPDATE_URL = `https://${CHAIN}.w3f.community/nominations`
  console.log('update url:', UPDATE_URL)
  const MONGO_CONNECTION_URL = createUrl()
  // const FUNCTION = `w3f-1kv-nominations-${CHAIN}-update`

  var dbc
  var res
  var result
  var active_vals = []

  try {
    res = await axios.get(UPDATE_URL)
  } catch (err) {
    console.error(err)
  }

  if (res?.data) {
    const nominations = res.data
    // update the db
    try {
      dbc = await prepareDB(MONGO_CONNECTION_URL, MONGO_DATABASE)
      const col = dbc.collection(MONGO_COLLECTION)
      // TODO: do we need to track changes over time?
      // await col.deleteMany({ chain: CHAIN })
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
      console.warn('ERROR 1kv-nominations-update')
      console.error(err)
    // } finally {
      // console.log('closing database connection')
      // await closeDB()
      // console.log('...closed')
    }
    console.log('finished processing res.data')

  } else {
    slog('res.data was empty')
    result = {
      reason: 'res.data was empty',
      'body': JSON.stringify(res),
    }
  }
  console.log('1kv-nominations-update done...', CHAIN)

}
