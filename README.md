
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


# .env

There is a `.env` file. 
Then use `. .env` to login

```
#!/bin/bash

# GATEWAY LOGIN
export GATEWAY_IP="192.168.1.91" # ip of your openfaas/faasd gateway
export OPENFAAS_PREFIX=derekc
export OPENFAAS_URL=http://$GATEWAY_IP:8080
export OPENFAAS_ADMIN_PASSWORD= [ get this from password manager ]

export DOCKER_PASSWORD= [ get this from password manager ]

```


