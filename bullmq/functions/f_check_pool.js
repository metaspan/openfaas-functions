import Telegram from 'telegraf/telegram';
import { ApiPromise, WsProvider } from '@polkadot/api'
import axios from 'axios';

// todo: move to config
const pools = {
  polkadot: '13UVJyLnbVp8c4FQeiGDrYotodEcyAzE8tipNEMc61UBJAH4', // pool stash
  kusama: 'F3opxRbN5ZavB4LTn2JaUnScQc7G7G177CPnqjBpa9F9Gdr',
}
const TELEGRAM_BOT_TOKEN = '5634840351:AAGx6SekIhkz9ExEr_TFAjRH67b2_iyorWI';
const TELEGRAM_CHAT_ID = '651499652';

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
  console.log(`${poolAddress} has Active Validator: ${hasActiveValidator}`);

  // // send notification to telegram
  // const telegram = new Telegram(TELEGRAM_BOT_TOKEN);
  // const message = `${poolAddress} has Active Validator: ${hasActiveValidator}`;
  // telegram.sendMessage(TELEGRAM_CHAT_ID, message);

  // send notification to telegram
  const message = `${poolAddress} has Active Validator: ${hasActiveValidator}`;
  const respo = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${message}`);
  if(respo.data?.ok) {
    job.log(`Telegram notification sent`)
  } else {
    job.log(`Telegram notification failed`)
  }
  // Close the connection
  await api.disconnect();

}
