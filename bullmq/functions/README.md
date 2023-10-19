
# Deployment

Alert bots run on miner1 in pm2 - they trigger bullmq functions
The server runs on miner1 under pm2: bullmq

# Development process

Source code on github
```bash
git clone https://github.com/metaspan/openfaas-functions
cd openfaas-functions/bullmq
```

Create a function in `./functions`
amend server.js to include the function
restart the server with 

```bash
pm2 restart bullmq
```

# Triggering a function

```bash
curl -X POST http://localhost:3000/function/trigger -d '{"name":"test"}'
```
