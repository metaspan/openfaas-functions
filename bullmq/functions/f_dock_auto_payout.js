'use strict'

// import axios from 'axios'
// import moment from 'moment'
// import { MongoClient } from 'mongodb'
// const { ApiPromise, WsProvider } = require('@polkadot/api')
const { DockAPI } = require('@docknetwork/sdk')
const dock = new DockAPI()
const keyring = require('@polkadot/ui-keyring').default;
const fs = require('fs');
// const prompts = require('prompts');
// const yargs = require('yargs');
// const config = require('./config.js');
// import { createUrl, prepareDB, closeDB } from '../../../dock.io/dock-auto-payout/bullmq/functions/utils.js'
// function slog (str) { job.log('1kv-candidates:' + str) }

export async function f_dock_auto_payout (job) {
  // WARNING: this could expose the DB password
  // job.log(job.data);
  job.log('Starting', job.name)

  keyring.initKeyring({
    isDevelopment: false,
  });

  // const argv = yargs
  //  .scriptName("autopayout.js")
  //  .option('account', {
  //    alias: 'a',
  //    description: 'Account json file path',
  //    type: 'string',
  //  })
  //  .option('password', {
  //      alias: 'p',
  //      description: 'Account password, or stdin if this is not set',
  //      type: 'string',
  //  })
  //  .option('validator', {
  //    alias: 'v',
  //    description: 'Validator address',
  //    type: 'string',
  //  })
  //  .option('log', {
  //    alias: 'l',
  //    description: 'log (append) to autopayout.log file',
  //    type: 'boolean',
  //  })
  //  .usage("node autopayout.js -c keystores/account.json -p password -v validator_stash_address")
  //  .help()
  //  .alias('help', 'h')
  //  .version()
  //  .alias('version', 'V')
  //  .argv;
 
  // // Exported account json file param
  // const accountJSON = argv.account || config.accountJSON;
  // // Password param
  // let password = argv.password || config.password;
  // // Validator address param
  // const validator = argv.validator || config.validator;
  // // Logging to file param
  // const log = argv.log || config.log;
  // // Node websocket
  // const wsProvider = config.nodeWS;

  const { accountJSON, password, validator, log, } = job.data
 
  job.log("\n\x1b[45m\x1b[1m Dock.io auto payout \x1b[0m\n");
  job.log("\x1b[1m - Check source at https://github.com/metaspan/dock-auto-payout\x1b[0m");
 
  let raw;
  try {
    raw = fs.readFileSync(accountJSON, { encoding: 'utf-8' });
  } catch(err) {
    job.log(`\x1b[31m\x1b[1mError! Can't open ${accountJSON}\x1b[0m\n`);
    process.exit(1);
  }

  const account = JSON.parse(raw);
  const address = account.address;

  if (!validator) {
    job.log(`\x1b[31m\x1b[1mError! Empty validator stash address\x1b[0m\n`);
    throw new Error('Empty validator stash address');
    // process.exit(1);
  } else {
    job.log(`\x1b[1m -> Validator stash address is\x1b[0m`, validator);
  }
  
  // Prompt user to enter password
  if (!password) {
    job.log(`\x1b[31m\x1b[1mError! Empty password\x1b[0m\n`);
    throw new Error('Empty password')
    // process.exit(1);
  }

  if (password) {
    job.log(`\x1b[1m -> Importing account\x1b[0m`, address);
    const signer = keyring.restoreAccount(account, password);
    signer.decodePkcs8(password);

    // Connect to node
    await dock.init({ address: wsProvider, keyring });
    const api = dock.api;

    // Check account balance
    const accountBalance = await api.derive.balances.all(address);
    const availableBalance = accountBalance.availableBalance;
    if (availableBalance.eq(0)) {
      job.log(`\x1b[31m\x1b[1mError! Account ${address} doesn't have available funds\x1b[0m\n`);
      process.exit(1);
    }
    job.log(`\x1b[1m -> Account ${address} available balance is ${availableBalance.toHuman()}\x1b[0m`);

    // Get session progress info
    const chainActiveEra = await api.query.staking.activeEra();
    const activeEra = JSON.parse(JSON.stringify(chainActiveEra)).index;
    job.log(`\x1b[1m -> Active era is ${activeEra}\x1b[0m`);
  
    // Check validator unclaimed rewards
    const stakingInfo = await api.derive.staking.account(validator);
    // for some reason, era's after 1183 seem to have different datatype
    const claimedRewards = stakingInfo.stakingLedger.claimedRewards.map(era => Number(era));
    job.log(`\x1b[1m -> Claimed eras: [${claimedRewards.join(',')}]\x1b[0m`);
 
    let transactions = [];
    let unclaimedRewards = [];
    // go back 84 era, before that payouts are lost
    let era = activeEra > 84 ? activeEra - 84 : 0;

    for (era; era < activeEra; era++) {
      const eraPoints = await api.query.staking.erasRewardPoints(era);
      const eraValidators = Object.keys(eraPoints.individual.toHuman());
      if (eraValidators.includes(validator) && !claimedRewards.includes(era)) {
        job.log(`validator ${validator} has unclaimed rewards in era ${era}`)
        transactions.push(api.tx.staking.payoutStakers(validator, era));
        unclaimedRewards.push(era);
      // } else {
      //   job.log(`validator ${validator} has no unclaimed payouts in era ${era}`)
      }
    }
    if (transactions.length > 0) {
      job.log(`\x1b[1m -> Unclaimed eras: ${JSON.stringify(unclaimedRewards)}\x1b[0m`);

      // Message: There is currently an ongoing election for new validator candidates. As such staking operations are not permitted.
      // we need to check if staking actions are permitted
      const phase = await api.query.electionProviderMultiPhase.currentPhase()
      if (phase.toString() === 'Off') {
        job.log('electionProviderMultiPhase.currentPhase() is Off, we can submit the batch')
      } else {
        job.log(`electionProviderMultiPhase.currentPhase() is ${phase.toString()}, we can NOT submit the batch`)
        process.exit(1)
      }

      // Claim rewards tx
      const nonce = (await api.derive.balances.account(address)).accountNonce;
      let blockHash = null;
      let extrinsicHash = null;
      let extrinsicStatus = null;
      await api.tx.utility.batch(transactions)
        .signAndSend(
          signer,
          { nonce },
          ({ events = [], status }) => {
            extrinsicStatus = status.type
            if (status.isInBlock) {
              extrinsicHash = status.asInBlock.toHex()
            } else if (status.isFinalized) {
              blockHash = status.asFinalized.toHex()
            }
            job.log(extrinsicStatus, extrinsicHash, blockHash)
          }
        )
      job.log(extrinsicStatus, extrinsicHash, blockHash)
      job.log(`\n\x1b[32m\x1b[1mSuccess! \x1b[37mCheck tx in PolkaScan: https://polkascan.io/kusama/transaction/${blockHash}\x1b[0m\n`);

      if (log) {
        fs.appendFileSync(`autopayout.log`, `${new Date()} - Claimed rewards, transaction hash is ${extrinsicHash}`);
      }
    } else {
      job.log(`\n\x1b[33m\x1b[1mWarning! There are no unclaimed rewards, exiting!\x1b[0m\n`);
    }
    process.exit(0);
  }
}
 
  // const { MONGO_DATABASE } = process.env
  // const { CHAIN } = job.data
  // const MONGO_COLLECTION = '1kv_candidate'
  // const UPDATE_URL = `https://${CHAIN}.w3f.community/candidates`
  // job.log('update url:', UPDATE_URL)
  // const MONGO_CONNECTION_URL = createUrl(job.data)
  // const FUNCTION = `w3f-1kv-candidates-${CHAIN}-update`

  // // await logger.debug(FUNCTION, event)
  // // var res = await axios.get(`http://192.168.1.2:1880/job-log?host=gateway&name=function:${FUNCTION}&action=start`)
  // // const { id } = res.data

  // var dbc
  // var res
  // var result
  // var active_vals = []
  // try {
  //   slog('getting data from validators ' + `http://192.168.1.92:3000/${CHAIN}/query/session/validators`)
  //   var vals = await axios.get(`http://192.168.1.92:3000/${CHAIN}/query/session/validators`)
  //   // job.log(vals.data)
  //   active_vals = vals.data || []
  //   slog('getting data from ' + UPDATE_URL)
  //   res = await axios.get(UPDATE_URL)
  // } catch (err) {
  //   job.log(err)
  //   slog('ERROR getting candidates from' + UPDATE_URL)
  //   // await logger.error(FUNCTION, err.response.code)
  // }

  // if (res?.data) {
  //   const candidates = res.data
  //   try {
  //     slog('connecting to db')
  //     dbc = await prepareDB(MONGO_CONNECTION_URL, MONGO_DATABASE)
  //     const col = dbc.collection(MONGO_COLLECTION)

  //     // de-activate candidates no longer in the list
  //     let stashes = candidates.map(m => m.stash)
  //     let update = { $set: { stale: true, updatedAt: moment().utc().format() } }
  //     slog('Updating stale=true batch')
  //     await col.updateMany({ chain: CHAIN, stale: false, stash: { '$nin': stashes } }, update)

  //     // upsert all [new] candidates
  //     slog('starting candidates.forEach()')
  //     // candidates.forEach(async (candidate) => {
  //     for (var i = 0; i < candidates.length; i++) {
  //       var candidate = candidates[i]
  //       // slog('handling candidate ' + JSON.stringify(candidate))
  //       const query = {
  //         chain: CHAIN,
  //         // _id: candidate._id,
  //         stash: candidate.stash
  //       }
  //       candidate.chain = CHAIN
  //       // recalculate 'valid'
  //       candidate.valid = candidate.validity.filter(f => f.valid === false).length === 0
  //       candidate.stale = false
  //       candidate.active = active_vals.includes(candidate.stash) ? 1 : 0
  //       candidate.updatedAt = moment().utc().format()
  //       slog('upserting candidate '+ candidate.stash)
  //       const result = await col.replaceOne(query, candidate, { upsert: true })
  //     }
  //     result = {
  //       candidates_updated: candidates.length,
  //       candidates: candidates.map(n => { return { _id: n._id, stash: n.stash } }),
  //       // 'content-type': event.headers["content-type"]
  //       'content-type': 'application/json'
  //     }
  //   } catch (err) {
  //     job.log(err)
  //     await logger.error(FUNCTION, err)
  //     result = {
  //       error: JSON.stringify(err),
  //       // 'content-type': event.headers["content-type"],
  //       'content-type': 'application/json'
  //     }
  //   } finally {
  //     job.log('closing database connection')
  //     // await dbc.close()
  //     await closeDB()
  //     job.log('...closed')
  //   }
  //   job.log('finished processing res.data')

  // } else {
  //   slog('res.data was empty')
  //   result = {
  //     reason: 'res.data was empty',
  //     'body': JSON.stringify(res),
  //   }
  // }
  job.log(`${job.name} done...`)

}
