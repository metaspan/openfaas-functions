'use strict'

import axios from 'axios'
import moment from 'moment'
import { REST_API_BASE, createUrl, prepareDB, getAllPools } from './utils.js'

function slog (str) { console.log('w3f-exposures:' + str) }

export async function f_w3f_pools_update (job) {
  // WARNING, this could print the db password!
  // console.log(job.data);

  const { MONGO_DATABASE } = process.env
  const { CHAIN } = job.data
  const MONGO_COLLECTION = 'w3f_pool'
  const MONGO_CONNECTION_URL = createUrl()

  var dbc
  var result
  var pools = []
  var members = []

  try {
    slog(job.name + ': getting members')
    // var entries = await api.query.nominationPools.poolMembers.entries()
    res = await axios.get(`${REST_API_BASE}/${CHAIN}/query/nominationPools/poolMembers`)
    members = res?.data?.poolMembers || {}
    slog('getting pools')
    pools = await getAllPools(CHAIN)
    slog(`... found ${pools.length}`)
  } catch (err) {
    job.log(err)
    // console.warn(`ERROR: ${FUNCTION}`)
    // console.warn(err)
    // await logger.error(FUNCTION, err)
  }

  try {
    dbc = await prepareDB(MONGO_CONNECTION_URL, MONGO_DATABASE)
    const col = dbc.collection(MONGO_COLLECTION)
    for(var i = 0; i < pools.length; i++) {
      const pool = pools[i]
      const query = {
        id: pool.id,
        // stash: pool.stash
      }
      pool.chain = CHAIN
      pool.members = members[pool.id]
      pool.updatedAt = moment().utc().format()
      const result = await col.replaceOne(query, pool, { upsert: true })
    }
    result = {
      pools_updated: pools.length,
      pools: pools.map(n => { return { id: n.id, name: n.name } }),
      // 'content-type': event.headers["content-type"]
      'content-type': 'application/json'
    }
  } catch (err) {
    console.warn(`ERROR: ${FUNCTION}`)
    console.warn(err)
    // await logger.error(FUNCTION, err)
    // result = {
    //   error: err,
    //   // 'content-type': event.headers["content-type"],
    //   'content-type': 'application/json'
    // }
  }

  job.log('w3f-pools-update done...', CHAIN)
  return result
}
