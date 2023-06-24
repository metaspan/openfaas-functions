

export async function f_log_test(job) {
  // WARNING: this could expose the keystore password
  // console.log(job.data);
  console.log('Starting', job.name)
  job.log('Starting', job.name)
  return {
    one: 1,
    hello: 'world'
  }

}
