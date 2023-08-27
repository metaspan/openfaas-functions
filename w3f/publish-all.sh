#!/bin/bash

for n in `ls *.yml`; do
  echo "$n";
  faas-cli publish --platforms linux/amd64 -f $n;
done

# ../deploy-all.sh
