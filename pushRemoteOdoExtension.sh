#!/bin/bash

# To be run from the codewind/src/pfe directory

# Get the PFE pod in the current namespace
if [ -z "$1" ]; then
  echo "Please pass in the PFE Pod name as the parameter"
  exit 1
fi

PFE=$1
ODO_EXT_PATH=/codewind-workspace/.extensions/codewind-odo-extension-devfile

# kubectl cp ./codewind.yaml $PFE:$ODO_EXT_PATH/codewind.yaml
# kubectl cp ./templatesProvider.js $PFE:$ODO_EXT_PATH/templatesProvider.js
kubectl cp ./odo-extension-entrypoint.sh $PFE:$ODO_EXT_PATH/odo-extension-entrypoint.sh
kubectl cp ./scripts $PFE:$ODO_EXT_PATH
kubectl cp ./setup  $PFE:$ODO_EXT_PATH
kubectl cp ./templates $PFE:$ODO_EXT_PATH

kubectl logs -f $PFE

# touch ./restartPFE.temp
# kubectl cp ./restartPFE.temp $PFE:/portal/docs/restartPFE.temp
# rm ./restartPFE.temp
