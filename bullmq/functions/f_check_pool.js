import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config('../../.env')

// import Telegram from 'telegraf/telegram';
import { ApiPromise, WsProvider } from '@polkadot/api'
import axios from 'axios';

// todo: move to config
// const pools = {
//   polkadot: '13UVJyLnbVp8c4FQeiGDrYotodEcyAzE8tipNEMc61UBJAH4', // pool stash
//   kusama: 'F3opxRbN5ZavB4LTn2JaUnScQc7G7G177CPnqjBpa9F9Gdr',
// }
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function f_check_pool (job) {

  job.log(`Starting ${job.name}`)
  const { chainId, poolAddress } = job.data

  // const poolAddress = pools[chainId]
  job.log(`chainId: ${chainId}, poolAddress: ${poolAddress}`)

  // const provider = new WsProvider('ws://rpc.polkadot.io')
  const provider = new WsProvider(`wss://rpc.metaspan.io/${chainId}`);
  // const provider = new WsProvider(`wss://rpc.ibp.network/${chainId}`);
  const api = await ApiPromise.create({ provider });

  const nominations = await api.query.staking.nominators(poolAddress);
  // If the pool has nominations, extract the nominated validator addresses
  const nominatedValidators = nominations.isSome ? nominations.unwrap().targets.map(validator => validator.toString()) : [];
  // console.log(nominatedValidators);

  // check if validator is in active set
  const validators = await api.query.session.validators();
  const activeValidators = validators.map(validator => validator.toString());
  // console.log(activeValidators);

  const hasActiveValidator = nominatedValidators.some(validator => activeValidators.includes(validator));
  job.log(`${poolAddress} has active validator: ${hasActiveValidator}`);

  // send notification to telegram
  const message = `${chainId} pool active: ${hasActiveValidator}`;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${message}`
    console.debug('url', url)
    // job.log(`URL: ${url}`)
    const respo = await axios.get(url);
    if(respo.data?.ok) {
      job.log(`Telegram notification sent`)
    } else {
      job.log(`Telegram notification failed`)
    }
  } catch (err) {
    console.error(err)
    job.error(err)
  }
  // Close the connection
  await api.disconnect();

}
