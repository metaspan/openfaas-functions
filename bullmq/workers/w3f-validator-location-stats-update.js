'use strict'

import axios from 'axios'
import moment from 'moment'
import { createUrl, prepareDB } from './utils.js'

// function slog (str) { console.log('w3f-exposures:' + str) }

export async function f_w3f_validator_location_stats_update (job) {
  // WARNING, this could print the db password!
  // console.log(job.data);

  const { MONGO_DATABASE } = process.env
  const { CHAIN } = job.data

  const UPDATE_URL = `https://${CHAIN}.w3f.community/locationstats`
  const MONGO_COLLECTION = 'w3f_location_stats'
  const MONGO_CONNECTION_URL = createUrl()

  var dbc
  var result
  const res = await axios.get(UPDATE_URL)

  if (res?.data) {
    const locations = res.data.locations
    // update the db
    try {
      dbc = await prepareDB(MONGO_CONNECTION_URL, MONGO_DATABASE)
      const col = dbc.collection(MONGO_COLLECTION)
      locations.forEach(async (location) => {
        const query = {
          _id: location._id,
          // stash: location.stash
        }
        location.chain = CHAIN
        location.updatedAt = moment().utc().format()
        const result = await col.replaceOne(query, location, { upsert: true })
      })
      result = {
        locations_updated: locations.length,
        locations: locations
      }
    } catch (err) {
      result = {
        error: err,
      }
    }
  } else {
    result = {
      'error': 'res.data null?'
    }
  }

  job.log('w3f-pools-update done...', CHAIN)
  return result
}
