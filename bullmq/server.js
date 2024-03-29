import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config()

import express from 'express'
import { Queue, Worker } from 'bullmq'
import { ExpressAdapter, createBullBoard, BullAdapter, BullMQAdapter } from '@bull-board/express'
import axios from 'axios'

import { asyncForEach } from './workers/utils.js'
import { f_1kv_candidates_update } from './workers/1kv-candidates-update.js'
import { f_1kv_nominations_update } from './workers/1kv-nominations-update.js'
import { f_1kv_nominators_update } from './workers/1kv-nominators-update.js'
import { f_w3f_exposures_update } from './workers/w3f-exposures-update.js'
import { f_w3f_nominators_update } from './workers/w3f-nominators-update.js'
import { f_w3f_pools_update } from './workers/w3f-pools-update.js'
import { f_w3f_validator_location_stats_update } from './workers/w3f-validator-location-stats-update.js'
import { f_w3f_validators_update } from './workers/w3f-validators-update.js'
import { f_w3f_nominations_update } from './workers/w3f-nominations-update.js'
// why did we switch to functions?
import { f_dock_auto_payout } from './functions/f_dock_auto_payout.js'
import { f_log_test } from './functions/f_log_test.js'
import { f_check_pool } from './functions/f_check_pool.js'

const env = process.env
const chains = ['kusama', 'polkadot']

const qOpts = {
  // connection to Redis
  connection: {
    host: "192.168.1.38",
    port: 6379
  }
};

const jobs = [
  '1kv_candidates_update',
  '1kv_nominations_update',
  '1kv_nominators_update',
  'w3f_exposures_update',
  'w3f_nominators_update',
  'w3f_pools_update',
  'w3f_validator_location_stats_update',
  'w3f_validators_update',
  'w3f_nominations_update',
  'dock_auto_payout',
  'log_test',
  'check_pool',
]

async function onError (job, err) {
  const errStr = `ERROR: ${job}: ` + typeof err === 'string' ? err : JSON.stringify(err)
  await axios.get('http://192.168.1.2:1880/sendToTelegram?text='+ errStr)
}

async function onFailed (job, event) {
  const errStr = `FAILED: ${job}: ` + typeof event === 'string' ? event : JSON.stringify(event)
  await axios.get('http://192.168.1.2:1880/sendToTelegram?text='+ errStr)
}

const q_1kv_candidates_update = new Queue('1kv_candidates_update', qOpts)
const q_1kv_nominations_update = new Queue('1kv_nominations_update', qOpts)
const q_1kv_nominators_update = new Queue('1kv_nominators_update', qOpts)
const q_w3f_exposures_update = new Queue('w3f_exposures_update', qOpts)
const q_w3f_nominators_update = new Queue('w3f_nominators_update', qOpts)
const q_w3f_pools_update = new Queue('w3f_pools_update', qOpts)
const q_w3f_validator_location_stats_update = new Queue('w3f_validator_location_stats_update', qOpts)
const q_w3f_validators_update = new Queue('w3f_validators_update', qOpts)
const q_w3f_nominations_update = new Queue('w3f_nominations_update', qOpts)
const q_dock_auto_payout = new Queue('dock_auto_payout', qOpts)
const q_log_test = new Queue('log_test', qOpts)
const q_check_pool = new Queue('check_pool', qOpts)

const w_1kv_candidates_update = new Worker('1kv_candidates_update', f_1kv_candidates_update, qOpts)
const w_1kv_nominations_update = new Worker('1kv_nominations_update', f_1kv_nominations_update, qOpts)
const w_1kv_nominators_update = new Worker('1kv_nominators_update', f_1kv_nominators_update, qOpts)
const w_w3f_exposures_update = new Worker('w3f_exposures_update', f_w3f_exposures_update, qOpts)
const w_w3f_nominators_update = new Worker('w3f_nominators_update', f_w3f_nominators_update, qOpts)
const w_w3f_pools_update = new Worker('w3f_pools_update', f_w3f_pools_update, qOpts)
const w_w3f_validator_location_stats_update = new Worker('w3f_validator_location_stats_update', f_w3f_validator_location_stats_update, qOpts)
const w_w3f_validators_update = new Worker('w3f_validators_update', f_w3f_validators_update, qOpts)
const w_w3f_nominations_update = new Worker('w3f_nominations_update', f_w3f_nominations_update, qOpts)
const w_dock_auto_payout = new Worker('dock_auto_payout', f_dock_auto_payout, qOpts)
const w_log_test = new Worker('log_test', f_log_test, qOpts)
const w_check_pool = new Worker('check_pool', f_check_pool, qOpts)

// handle all error/failed
jobs.forEach(job => {
  const worker = eval(`w_${job}`)
  worker.on('error', (err) => onError(job, err))
  worker.on('failed', (event) => onFailed(job, event))
})

const jobRetention = {
  removeOnComplete: {
    age: 24 * 60 *60, // keep up to 24 hour (in millis)
    count: 1000, // keep up to 1000 jobs
  },
  removeOnFail: {
    age: 48 * 60 * 60, // keep up to 48 hours (in millis)
  }
}

async function clearQueue (jobname) {
  let qname = eval(`q_${jobname}`)
  await qname.pause()
  // Removes all jobs that are waiting or delayed, but not active, completed or failed
  await qname.drain()
  // Completely obliterates a queue and all of its contents.
  // if (qname.) 
  await qname.resume()
}

(async () => {

  async function clearQueues () {
    await asyncForEach(jobs, clearQueue)
  }

  async function addJobs() {
    // await q1.add('myJobName', { foo: 'bar' });
    // await q1.add('myJobName', { qux: 'baz' });
    asyncForEach(chains, async (CHAIN, idx, arr) => {
      const jOpts = { CHAIN }

      await q_1kv_candidates_update.add(`1kv_candidates_${CHAIN}`, jOpts,
        { group: { id: 1 }, repeat: { pattern: '00,30 * * * *' }, ...jobRetention })
      await q_1kv_nominations_update.add(`1kv_nominations_${CHAIN}`, jOpts,
        { group: { id: 1 }, repeat: { pattern: '01,31 * * * *' }, ...jobRetention })
      await q_1kv_nominators_update.add(`1kv_nominators_${CHAIN}`, jOpts,
        { repeat: { pattern: '02,32 * * * *' }, ...jobRetention })
      // =================== we will trigger the w3f jobs from the alert bot  ======================
      // await q_w3f_exposures_update.add(`w3f_exposures_${CHAIN}`, jOpts,
      //   { repeat: { pattern: '03,33 * * * *' }, ...jobRetention })
      // await q_w3f_nominators_update.add(`w3f_nominators_${CHAIN}`, jOpts,
      //   // once per hour
      //   { repeat: { pattern: '04 * * * *' }, ...jobRetention })
      await q_w3f_pools_update.add(`w3f_pools_${CHAIN}`, jOpts,
        { group: { id: 2 }, repeat: { pattern: '05,35 * * * *' }, ...jobRetention })
      await q_w3f_validator_location_stats_update.add(`w3f_validator_location_stats_${CHAIN}`, jOpts,
        { repeat: { pattern: '06,36 * * * *' }, ...jobRetention })
      // await q_w3f_validators_update.add(`w3f_validators_${CHAIN}`, jOpts,
      //   { repeat: { pattern: '07,37 * * * *' }, ...jobRetention })
      // await q_w3f_nominations_update.add(`w3f_nominations_${CHAIN}`, jOpts,
      //   { repeat: { pattern: '07,37 * * * *' }, ...jobRetention })
      // dock-alert-bot will add jobs for dock_auto_payout
      // kusama and polkadot alert bot will add jobs for check_pool
    })
  }

  await clearQueues()
  await addJobs()

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  // const queueMQ = new QueueMQ()
  const { setQueues, replaceQueues } = createBullBoard({
    queues: [
      new BullMQAdapter(q_1kv_candidates_update, { readOnlyMode: false }),
      new BullMQAdapter(q_1kv_nominations_update, { readOnlyMode: false }),
      new BullMQAdapter(q_1kv_nominators_update, { readOnlyMode: false }),
      new BullMQAdapter(q_w3f_exposures_update, { readOnlyMode: false }),
      new BullMQAdapter(q_w3f_nominators_update, { readOnlyMode: false }),
      new BullMQAdapter(q_w3f_pools_update, { readOnlyMode: false }),
      new BullMQAdapter(q_w3f_validator_location_stats_update, { readOnlyMode: false }),
      new BullMQAdapter(q_w3f_validators_update, { readOnlyMode: false }),
      new BullMQAdapter(q_w3f_nominations_update, { readOnlyMode: false }),
      new BullMQAdapter(q_dock_auto_payout, { readOnlyMode: false }),
      new BullMQAdapter(q_log_test, { readOnlyMode: false }),
      new BullMQAdapter(q_check_pool, { readOnlyMode: false }),
    ],
    serverAdapter: serverAdapter,
  })
  const app = express();
  app.use('/admin/queues', serverAdapter.getRouter());
  app.listen(3000, () => {
    console.log('Running on 3000...');
    console.log('For the UI, open http://localhost:3000/admin/queues');
    // console.log('Make sure Redis is running on port 6379 by default');
  });
  
})()
