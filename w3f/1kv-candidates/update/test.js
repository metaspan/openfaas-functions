

const { ApiPromise, WsProvider } = require('@polkadot/api')
const { hexToString } = require('@polkadot/util')
const axios = require('axios')
const moment = require('moment-timezone')

async function getEndpoints () {
  const res = await axios.get('https://api.metaspan.io/function/w3f-endpoints')
  return res.data
}

async function getStakingValidators(api) {
  // const keys = await api.query.staking.validators.keys()
  const keys = await api.query.session.validators()
  // console.log(keys)
  // const ids = keys.map(({ args: [stash] }) => stash.toJSON())
  var ids = keys.map(k => k.toString())
  // keys.forEach(key => {
  //   console.log(key.toString())
  // })
  console.log(ids)
  return ids
}


(async () => {
  const endpoints = await getEndpoints()
  const provider = new WsProvider(endpoints['kusama']['local'])
  const api = await ApiPromise.create({ provider: provider })
  const vals = await getStakingValidators(api)
})()
