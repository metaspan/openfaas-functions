'use strict'

/**
 * for each nominator, calculate their balances
 */

import moment from 'moment'
import { createUrl, prepareDB, closeDB, getAccountsMulti } from './utils.js'

function slog (str) { console.log('w3f-exposures:' + str) }

export async function f_w3f_nominations_update (job) {
  // WARNING, this could print the db password!
  // console.log(job.data);

  const { MONGO_DATABASE } = process.env
  const { CHAIN } = job.data
  const MONGO_COLLECTION = 'w3f_account'
  const MONGO_CONNECTION_URL = createUrl()

  var dbc
  var result
  var nominators = []
  var accounts = []

  try {
    dbc = await prepareDB(MONGO_CONNECTION_URL, MONGO_DATABASE)
    nominators = await dbc.collection('w3f_nominator').find({chain: CHAIN}).toArray()
    // console.log(nominators)
    console.log(`there are ${nominators.length} nominators`)
    const chunksize = 50
    for(var i = 0; i < nominators.length; i += chunksize) {
      const ids = nominators.slice(i, i + chunksize).map(m => m.accountId)
      // console.debug('ids', ids)
      const accs = await getAccountsMulti(CHAIN, ids)
      // console.debug('accs', accs)
      accounts.push(...accs)
    }
    console.log(`there are ${accounts.length} accounts`)
  } catch (err) {
    console.error(err)
    // await logger.error(FUNCTION, err)
  }

  console.debug('updating database...')
  try {
    const col = dbc.collection(MONGO_COLLECTION)
    const updatedAt = moment().utc().format()
    nominators.forEach(async (nominator, idx) => {
      const query = {
        chain: CHAIN,
        accountId: nominator.accountId,
      }
      const account = accounts[idx] || {}
      account.accountId = nominator.accountId
      account.chain = CHAIN
      account.updatedAt = updatedAt
      const result = await col.replaceOne(query, account, { upsert: true })
    })
    await col.deleteMany({ chain: CHAIN, updatedAt: { $lt: updatedAt } })
    result = {
      accounts_updated: accounts.length,
      'content-type': 'application/json'
    }
  } catch (err) {
    console.error(err)
    result = {
      error: err,
      // 'content-type': event.headers["content-type"],
      'content-type': 'application/json'
    }
  }

  console.log('w3f-nominations-update done...', CHAIN)
  return result
}
