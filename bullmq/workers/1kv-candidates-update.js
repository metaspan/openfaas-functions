'use strict'
// import { Worker } from 'bullmq'

import axios from 'axios'
import moment from 'moment'
import { MongoClient } from 'mongodb'
// const { ApiPromise, WsProvider } = require('@polkadot/api')
import { createUrl, prepareDB, closeDB } from './utils.js'

function slog (str) { console.log('1kv-candidates:' + str) }

// async function addJobs() {
//   await q1.add('myJobName', { foo: 'bar' });
//   await q1.add('myJobName', { qux: 'baz' });
// }

// const worker = new Worker('1kv-candidates-update', async job => {
export async function f_1kv_candidates_update (job) {
  // WARNING: this could expose the DB password
  // console.log(job.data);
  job.log('Starting', job.name)

  const { MONGO_DATABASE } = process.env
  const { CHAIN } = job.data
  const MONGO_COLLECTION = '1kv_candidate'
  const UPDATE_URL = `https://${CHAIN}.w3f.community/candidates`
  console.log('update url:', UPDATE_URL)
  const MONGO_CONNECTION_URL = createUrl(job.data)
  const FUNCTION = `w3f-1kv-candidates-${CHAIN}-update`

  // await logger.debug(FUNCTION, event)
  // var res = await axios.get(`http://192.168.1.2:1880/job-log?host=gateway&name=function:${FUNCTION}&action=start`)
  // const { id } = res.data

  var dbc
  var res
  var result
  var active_vals = []
  try {
    slog('getting data from validators ' + `http://192.168.1.92:3000/${CHAIN}/query/session/validators`)
    var vals = await axios.get(`http://192.168.1.92:3000/${CHAIN}/query/session/validators`)
    // console.log(vals.data)
    active_vals = vals.data || []
    slog('getting data from ' + UPDATE_URL)
    res = await axios.get(UPDATE_URL)
  } catch (err) {
    console.log(err)
    slog('ERROR getting candidates from' + UPDATE_URL)
    // await logger.error(FUNCTION, err.response.code)
  }

  if (res?.data) {
    const candidates = res.data
    try {
      slog('connecting to db')
      dbc = await prepareDB(MONGO_CONNECTION_URL, MONGO_DATABASE)
      const col = dbc.collection(MONGO_COLLECTION)

      // de-activate candidates no longer in the list
      let stashes = candidates.map(m => m.stash)
      let update = { $set: { stale: true, updatedAt: moment().utc().format() } }
      slog('Updating stale=true batch')
      await col.updateMany({ chain: CHAIN, stale: false, stash: { '$nin': stashes } }, update)

      // upsert all [new] candidates
      slog('starting candidates.forEach()')
      // candidates.forEach(async (candidate) => {
      for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i]
        // slog('handling candidate ' + JSON.stringify(candidate))
        const query = {
          chain: CHAIN,
          // _id: candidate._id,
          stash: candidate.stash
        }
        candidate.chain = CHAIN
        // recalculate 'valid'
        candidate.valid = candidate.validity.filter(f => f.valid === false).length === 0
        candidate.stale = false
        candidate.active = active_vals.includes(candidate.stash) ? 1 : 0
        candidate.updatedAt = moment().utc().format()
        slog('upserting candidate '+ candidate.stash)
        const result = await col.replaceOne(query, candidate, { upsert: true })
      }
      result = {
        candidates_updated: candidates.length,
        candidates: candidates.map(n => { return { _id: n._id, stash: n.stash } }),
        // 'content-type': event.headers["content-type"]
        'content-type': 'application/json'
      }
    } catch (err) {
      console.log(err)
      await logger.error(FUNCTION, err)
      result = {
        error: JSON.stringify(err),
        // 'content-type': event.headers["content-type"],
        'content-type': 'application/json'
      }
    } finally {
      console.log('closing database connection')
      // await dbc.close()
      await closeDB()
      console.log('...closed')
    }
    console.log('finished processing res.data')

  } else {
    slog('res.data was empty')
    result = {
      reason: 'res.data was empty',
      'body': JSON.stringify(res),
    }
  }
  console.log('done...')

}
