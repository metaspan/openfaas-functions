import express from 'express';
// import Queue from 'bull';
import { Queue } from 'bullmq';
import { ExpressAdapter, createBullBoard, BullAdapter, BullMQAdapter } from '@bull-board/express';

// const someQueue = new Queue('someQueueName', {
//   redis: { port: 6379, host: '127.0.0.1', password: 'foobared' },
// }); // if you have a special connection to redis.
// const someOtherQueue = new Queue('someOtherQueueName');
// const queueMQ = new QueueMQ('queueMQName');

const qOpts = {
  connection: {
    host: "192.168.1.38",
    port: 6379
  }
};

const q_1kv_candidates_update = new Queue('1kv_candidates_update', qOpts)
const q_1kv_nominations_update = new Queue('1kv_nominations_update', qOpts)
const q_1kv_nominators_update = new Queue('1kv_nominators_update', qOpts)
const q_w3f_exposures_update = new Queue('w3f_exposures_update', qOpts)
const q_w3f_nominators_update = new Queue('w3f_nominators_update', qOpts)

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [
    // new BullAdapter(someQueue), new BullAdapter(someOtherQueue), new BullMQAdapter(queueMQ)
    new BullAdapter(q_1kv_candidates_update, { readOnlyMode: true }),
    new BullAdapter(q_1kv_nominations_update, { readOnlyMode: true }),
    new BullAdapter(q_1kv_nominators_update, { readOnlyMode: true }),
    new BullAdapter(q_w3f_exposures_update, { readOnlyMode: true }),
    new BullAdapter(q_w3f_nominators_update, { readOnlyMode: true }),
  ],
  serverAdapter: serverAdapter,
});

const app = express();

app.use('/admin/queues', serverAdapter.getRouter());

// other configurations of your server
  
app.listen(3000, () => {
  console.log('Running on 3000...');
  console.log('For the UI, open http://localhost:3000/admin/queues');
  console.log('Make sure Redis is running on port 6379 by default');
});
