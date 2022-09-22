
# HOW TO

## Local setup

Connect your development machine to 
- openfaas gateway
- docker repo

### Login to gateway

```
export GATEWAY_IP=`GATEWAY_IP` # ip of your openfaas/faasd gateway
export OPENFAAS_PREFIX=docker_username
export OPENFAAS_URL=http://$GATEWAY_IP:8080
faas-cli login --password secret123!
```

### Login to repo/directory

- docker.io user & password
- https://hub.docker.com/repositories
- WARNING, creates public repo’s…! Be super careful to use `.env` files..!!!

`faas-cli registry-login -u derekc --password secret123`

# FUNCTIONS

## metaspan

- http://GATEWAY_IP:8080/function/metaspan-web-app - a demo running Vue.js inside openfaas container
- http://GATEWAY_IP:8080/function/mongo-logger


## w3f

- http://GATEWAY_IP:8080/function/kusama-1kv-prometheus-exporter/<stash>
- http://GATEWAY_IP:8080/function/polkadot-1kv-prometheus-exporter/<stash>

### Each 30 mins, via cron running on the gateway machine

```
# m h  dom mon dow   command
00,30 * * * * curl --silent --output /dev/null http://GATEWAY_IP:8080/function/w3f-1kv-candidates-polkadot-update
00,30 * * * * curl --silent --output /dev/null http://GATEWAY_IP:8080/function/w3f-1kv-candidates-kusama-update
01,31 * * * * curl --silent --output /dev/null http://GATEWAY_IP:8080/function/w3f-1kv-nominators-polkadot-update
01,31 * * * * curl --silent --output /dev/null http://GATEWAY_IP:8080/function/w3f-1kv-nominators-kusama-update
02,32 * * * * curl --silent --output /dev/null http://GATEWAY_IP:8080/function/w3f-1kv-location-stats-polkadot-update
02,32 * * * * curl --silent --output /dev/null http://GATEWAY_IP:8080/function/w3f-1kv-location-stats-kusama-update
03,33 * * * * curl --silent --output /dev/null http://GATEWAY_IP:8080/function/w3f-1kv-nominations-polkadot-update
03,33 * * * * curl --silent --output /dev/null http://GATEWAY_IP:8080/function/w3f-1kv-nominations-kusama-update
```

- http://GATEWAY_IP:8080/function/w3f-1kv-candidates-polkadot-update
- http://GATEWAY_IP:8080/function/w3f-1kv-candidates-kusama-update
- http://GATEWAY_IP:8080/function/w3f-1kv-nominators-polkadot-update
- http://GATEWAY_IP:8080/function/w3f-1kv-nominators-kusama-update
- http://GATEWAY_IP:8080/function/w3f-1kv-location-stats-polkadot-update
- http://GATEWAY_IP:8080/function/w3f-1kv-location-stats-kusama-update
- http://GATEWAY_IP:8080/function/w3f-1kv-nominations-polkadot-update
- http://GATEWAY_IP:8080/function/w3f-1kv-nominations-kusama-update


# SECRETS

There is a ./secrets folder.
```
faas-cli secret [create|update] dotenv
... paste the text of the dotenv.json file ```
ctrl-d to save
```

# TODO

- implement cron-adapter / connecter native to faasd 
- WHERE DOES w3f-validators FIT ???

