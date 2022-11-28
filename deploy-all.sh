#!/bin/bash

. .env

# Openfaas login
faas-cli login --password ${ADMIN_PASSWORD}
# Registry (docker) login
faas-cli registry-login -u derekc --password ${DOCKER_PASSWORD}

cd metaspan
for n in `ls *.yml`; do echo ${n}; faas-cli deploy -f ${n}; done

cd ../w3f
for n in `ls *.yml`; do echo ${n}; faas-cli deploy -f ${n}; done

cd ..
echo "\ndone!"
