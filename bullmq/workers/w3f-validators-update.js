'use strict'

// import axios from 'axios'
import moment from 'moment'
import { createUrl, prepareDB, getAllNominators, getAllValidators } from './utils.js'

function slog (str) { console.log('w3f-exposures:' + str) }

export async function f_w3f_validators_update (job) {

  const { MONGO_DATABASE } = process.env
  const { CHAIN } = job.data
  const MONGO_COLLECTION = 'w3f_validator'
  const MONGO_CONNECTION_URL = createUrl()

  var dbc
  var result
  var validators = []
  var nominators = []
  var validator_nominators = {};

  function calcValidatorNominators() {
    validator_nominators = {}
    nominators.forEach(n => {
      n.targets.forEach(t => {
        if (validator_nominators[t]) {
          if (!validator_nominators[t].includes(n.accountId)) {
            validator_nominators[t].push(n.accountId)
          }
        } else {
          validator_nominators[t] = [n.accountId]
        }
      })
    })
  }

  try {
    slog('getting nominators')
    nominators = await getAllNominators(CHAIN, 128)
    slog(`... found ${nominators.length}`)
    slog('calc validator nominators')
    calcValidatorNominators()
    slog('getting validators')
    validators = await getAllValidators(CHAIN, validator_nominators, 128)
  } catch (err) {
    console.warn(`ERROR: ${FUNCTION}`)
    console.warn(err)
    // await logger.error(FUNCTION, err)
    job.log(err)
  }

  try {
    dbc = await prepareDB(MONGO_CONNECTION_URL, MONGO_DATABASE)
    const col = dbc.collection(MONGO_COLLECTION)
    validators.forEach(async (model) => {
      const query = {
        // _id: model._id,
        chain: CHAIN,
        stash: model.stash
      }
      model.chain = CHAIN
      model.updatedAt = moment().utc().format()
      const result = await col.replaceOne(query, model, { upsert: true })
    })
    result = {
      validators_updated: validators.length,
      validators: validators.map(n => { return { _id: n._id, stash: n.stash } })
    }
  } catch (err) {
    console.warn(`ERROR: ${FUNCTION}`)
    console.warn(err)
    await logger.error(FUNCTION, err)
    result = {
      error: err,
    }
  }

  //console.log('w3f-nominators-update done...', CHAIN)
  return result
}
