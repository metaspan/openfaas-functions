'use strict'

import { DockAPI } from '@docknetwork/sdk'
const dock = new DockAPI()
import keyring from '@polkadot/ui-keyring'; // .default;
import fs from 'fs';

export async function f_dock_auto_payout (job) {
  // WARNING: this could expose the keystore password
  // console.log(job.data);
  console.log('Starting', job.name)
  job.log(`Starting ${job.name}`)

  keyring.initKeyring({
    isDevelopment: false,
  });

  const { wsProvider, accountJSON, password, validators=[], log, } = job.data

  console.log("\n\x1b[45m\x1b[1m Dock.io auto payout \x1b[0m\n");
  console.log(`\x1b[1m - endpoint: ${wsProvider}\x1b[0m`);
  console.log("\x1b[1m - Check source at https://github.com/metaspan/dock-auto-payout\x1b[0m");
  
  // TODO import key from json or ?
  let raw;
  try {
    raw = fs.readFileSync(accountJSON, { encoding: 'utf-8' });
  } catch(err) {
    console.log(`\x1b[31m\x1b[1mError! Can't open ${accountJSON}\x1b[0m\n`);
    job.log(`\x1b[31m\x1b[1mError! Can't open ${accountJSON}\x1b[0m\n`);
    process.exit(1);
  }

  const account = JSON.parse(raw);
  const address = account.address;

  if (!validators || validators.length === 0) {
    console.log(`\x1b[31m\x1b[1mError! Empty validator stash address\x1b[0m\n`);
    job.log(`\x1b[31m\x1b[1mError! Empty validator stash address\x1b[0m\n`);
    throw new Error('Empty validator stash address');
    // process.exit(1);
  } else {
    console.log(`\x1b[1m -> Validator stash address is\x1b[0m`, validators.join(', '));
    job.log(`\x1b[1m -> Validator stash address is\x1b[0m ${validators.join(', ')}`);
  }
  
  // Prompt user to enter password
  if (!password) {
    console.log(`\x1b[31m\x1b[1mError! Empty password\x1b[0m\n`);
    job.log(`\x1b[31m\x1b[1mError! Empty password\x1b[0m\n`);
    throw new Error('Empty password')
    // process.exit(1);
  }

  if (password) {
    console.log(`\x1b[1m -> Importing account\x1b[0m`, address);
    job.log(`\x1b[1m -> Importing account\x1b[0m ${address}`);
    const signer = keyring.restoreAccount(account, password);
    signer.decodePkcs8(password);

    // Connect to node
    if (!dock.isConnected) {
      try {
        await dock.init({ address: wsProvider, keyring });
      } catch (err) {
        job.log(`Error occurred ${error}`);
        job.moveToFailed({ message: "API connection error" }, true);
      }
    }
    dock.api.on('error', (error) => {
      console.error('Error occurred', error);
      job.log(`Error occurred ${error}`);
      job.moveToFailed({ message: "API connection error" }, true);
    });
    const api = dock.api;

    // Check account balance
    const accountBalance = await api.derive.balances.all(address);
    const availableBalance = accountBalance.availableBalance;
    if (availableBalance.eq(0)) {
      console.log(`\x1b[31m\x1b[1mError! Account ${address} doesn't have available funds\x1b[0m\n`);
      job.log(`\x1b[31m\x1b[1mError! Account ${address} doesn't have available funds\x1b[0m\n`);
      process.exit(1);
    }
    console.log(`\x1b[1m -> Account ${address} available balance is ${availableBalance.toHuman()}\x1b[0m`);
    job.log(`\x1b[1m -> Account ${address} available balance is ${availableBalance.toHuman()}\x1b[0m`);

    // Get session progress info
    const chainActiveEra = await api.query.staking.activeEra();
    const activeEra = JSON.parse(JSON.stringify(chainActiveEra)).index;
    console.log(`\x1b[1m -> Active era is ${activeEra}\x1b[0m`);
    job.log(`\x1b[1m -> Active era is ${activeEra}\x1b[0m`);

    let transactions = [];
    let unclaimedRewards = [];
    // go back 84 era, before that payouts are lost
    let startEra = activeEra > 84 ? activeEra - 84 : 0;

    for(let i = 0; i < validators.length; i++) {
      const validator = validators[i]
      // Check validator unclaimed rewards
      const stakingInfo = await api.derive.staking.account(validator);
      // for some reason, era's after 1183 seem to have different datatype
      const claimedRewards = stakingInfo.stakingLedger.claimedRewards.map(era => Number(era));
      console.log(`\x1b[1m -> Claimed eras: [${claimedRewards.join(',')}]\x1b[0m`);
      job.log(`\x1b[1m -> Claimed eras: [${claimedRewards.join(',')}]\x1b[0m`);

      for (let era = startEra; era < activeEra; era++) {
        const eraPoints = await api.query.staking.erasRewardPoints(era);
        const eraValidators = Object.keys(eraPoints.individual.toHuman());
        if (eraValidators.includes(validator) && !claimedRewards.includes(era)) {
          console.log(`validator ${validator} has unclaimed rewards in era ${era}`)
          job.log(`validator ${validator} has unclaimed rewards in era ${era}`)
          transactions.push(api.tx.staking.payoutStakers(validator, era));
          unclaimedRewards.push(era);
        // } else {
        //   console.log(`validator ${validator} has no unclaimed payouts in era ${era}`)
        }
      }
    }

    if(transactions.length === 0) {
      console.log(`\n\x1b[33m\x1b[1mWarning! There are no unclaimed rewards, exiting!\x1b[0m\n`);
      job.log(`\n\x1b[33m\x1b[1mWarning! There are no unclaimed rewards, exiting!\x1b[0m\n`);
    }

    while (transactions.length > 0) {
      // limit transactions to n per batch
      const transactionCount = 5
      const batch = transactions.slice(0, transactionCount);
      console.debug('batch', batch)
      job.log('batch', JSON.stringify(batch))
      transactions = transactions.slice(transactionCount);
      unclaimedRewards = unclaimedRewards.slice(0, 10);
      console.log(`\x1b[1m -> Unclaimed eras: ${JSON.stringify(unclaimedRewards)}\x1b[0m`);
      job.log(`\x1b[1m -> Unclaimed eras: ${JSON.stringify(unclaimedRewards)}\x1b[0m`);

      // Message: There is currently an ongoing election for new validator candidates. As such staking operations are not permitted.
      // we need to check if staking actions are permitted
      const phase = await api.query.electionProviderMultiPhase.currentPhase()
      if (phase.toString() === 'Off') {
        console.log('electionProviderMultiPhase.currentPhase() is Off, we can submit the batch')
        job.log('electionProviderMultiPhase.currentPhase() is Off, we can submit the batch')

        // Claim rewards tx
        const nonce = (await api.derive.balances.account(address)).accountNonce;
        let blockHash = null;
        let extrinsicHash = null;
        let extrinsicStatus = null;
        // sleep for 3.5 seconds to avoid "Transaction is not valid" error
        await new Promise(r => setTimeout(r, 3500));
        await api.tx.utility.batch(batch)
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
              console.log(extrinsicStatus, extrinsicHash, blockHash)
            }
          )
        console.log(extrinsicStatus, extrinsicHash, blockHash)
        console.log(`\n\x1b[32m\x1b[1mSuccess! \x1b[37mCheck tx in PolkaScan: https://polkascan.io/kusama/transaction/${blockHash}\x1b[0m\n`);

        if (log) {
          fs.appendFileSync(`autopayout.log`, `${new Date()} - Claimed rewards, transaction hash is ${extrinsicHash}`);
        }

      } else {
        console.log(`electionProviderMultiPhase.currentPhase() is ${phase.toString()}, we can NOT submit the batch`)
        job.log(`electionProviderMultiPhase.currentPhase() is ${phase.toString()}, we can NOT submit the batch`)
        // process.exit(1)
      }

    }
    await dock.disconnect()
  }

  console.log(`${job.name} done...`)
  job.log(`${job.name} done...`)

}
