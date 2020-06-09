#!/usr/bin/env bash
###################################################################################
# Copyright (c) 2019 IBM Corporation and others.
# All rights reserved. This program and the accompanying materials
# are made available under the terms of the Eclipse Public License v2.0
# which accompanies this distribution, and is available at
# http://www.eclipse.org/legal/epl-v20.html
#
# Contributors:
#     IBM Corporation - initial API and implementation
###################################################################################

# Define general variables
ODO_EXTENSION_DIR=/codewind-workspace/.extensions/codewind-odo-extension-devfile
ODO_CLI=$ODO_EXTENSION_DIR/bin/odo

# General setup
source /file-watcher/scripts/constants.sh
set -o pipefail
util=/file-watcher/scripts/util.sh

COMMAND=$1
shift 1

function getAppName() {
    APP_NAME=$($ODO_CLI app list | tail -n 1 | awk '{print $1}')
    echo $APP_NAME
}

function getPodName() {
    local POD_NAME
    POD_NAME=$(kubectl get pods -l component=$COMPONENT_NAME -o jsonpath="{.items[0].metadata.name}")
    echo $POD_NAME
}

function getURL() {
    local URL
    URL=$(kubectl get routes $COMPONENT_NAME -o jsonpath="{.spec.host}")
    echo http://$URL
}

function getPort() {
    local PORT
    PORT=$(kubectl get routes $COMPONENT_NAME -o jsonpath="{.spec.host}")
    echo $PORT
}

function addOwnerReference() {
    PFE_LABEL="app=codewind-pfe,codewindWorkspace=$CHE_WORKSPACE_ID"
    COMPONENT_LABEL="app.kubernetes.io/instance=$COMPONENT_NAME"
    APP_LABEL="app.kubernetes.io/part-of=$APP_NAME"
    PFE_NAME=$(kubectl get rs --selector=$PFE_LABEL -o jsonpath='{.items[0].metadata.name}')
    PFE_UID=$(kubectl get rs --selector=$PFE_LABEL -o jsonpath='{.items[0].metadata.uid}')
    RESOURCES=('deployment')

    for RESOURCE in "${RESOURCES[@]}"; do
        echo "Adding owner reference to resource: $RESOURCE" |& tee -a $ODO_DEBUG_LOG
        RESOURCE_NAME=$(kubectl get $RESOURCE $COMPONENT_NAME -o jsonpath='{.metadata.name}')
        kubectl patch $RESOURCE $RESOURCE_NAME --patch '{"metadata": {"ownerReferences": [{"apiVersion": "apps/v1", "blockOwnerDeletion": true, "controller": true, "kind": "ReplicaSet", "name": "'$PFE_NAME'", "uid": "'$PFE_UID'"}]}}'
        if [ $? -ne 0 ]; then
            exit 3
        fi
    done
}

function addProjectIDLabel() {
    PFE_LABEL="app=codewind-pfe,codewindWorkspace=$CHE_WORKSPACE_ID"
    COMPONENT_LABEL="app.kubernetes.io/instance=$COMPONENT_NAME"
    APP_LABEL="app.kubernetes.io/part-of=$APP_NAME"
    RESOURCES=('deployment' 'services' 'routes')

    for RESOURCE in "${RESOURCES[@]}"; do
        echo "Adding projectID label to resource: $RESOURCE" |& tee -a $ODO_DEBUG_LOG
        RESOURCE_NAME=$(kubectl get $RESOURCE $COMPONENT_NAME -o jsonpath='{.metadata.name}')
        kubectl patch $RESOURCE $RESOURCE_NAME --patch '{"metadata":{"labels":{"projectID":"'$PROJECT_ID'"}}}'
        if [ $? -ne 0 ]; then
            exit 3
        fi
    done
}

function updateCodewindLinkEnvs() {
    PROJECT_LINKS_ENV_FILE="$PROJECT_DIRECTORY/.codewind-project-links.env"
    OLD_PROJECT_LINKS_ENV_FILE="$PROJECT_DIRECTORY/.codewind-project-links.env.old"
	if [ -f "$PROJECT_LINKS_ENV_FILE" ]; then
        # If files are the same don't update
        cmp -s $PROJECT_LINKS_ENV_FILE $OLD_PROJECT_LINKS_ENV_FILE
        if [ $? -eq 0 ]; then
            echo "Links have not changed, not updating the config"
            exit 0
        fi
        # If we have old links, first remove them all from the config
        # This ensure that when we delete a link, it is removed
        if [ -f "$OLD_PROJECT_LINKS_ENV_FILE" ]; then
            while read LINE; do $ODO_CLI config unset --env $(echo $LINE | awk -F'=' '{print $1}'); done < $OLD_PROJECT_LINKS_ENV_FILE
            if [ $? -ne 0 ]; then
                # Log the error but don't exit if we can't remove them
                echo "Error removing links from local config"
            fi
        fi

        # Add all the links to the config
        while read LINE; do $ODO_CLI config set --env $LINE; done < $PROJECT_LINKS_ENV_FILE
        if [ $? -ne 0 ]; then
            echo "Error adding new links to local config"
            exit 3
        fi

        # Update the config
        $ODO_CLI push --config
        if [ $? -ne 0 ]; then
            echo "Error pushing config to add new links"
            exit 3
        fi

        # Create and update the OLD_PROJECT_LINKS file
        > $OLD_PROJECT_LINKS_ENV_FILE
        while read LINE; do echo $LINE >> $OLD_PROJECT_LINKS_ENV_FILE; done < $PROJECT_LINKS_ENV_FILE
        echo "Codewind links updated successfully"
	fi
}

if [ $COMMAND == "getAppName" ]; then
    getAppName
elif [ $COMMAND == "getPodName" ]; then
    COMPONENT_NAME=$1
    APP_NAME=$2
    getPodName
elif [ $COMMAND == "getURL" ]; then
    COMPONENT_NAME=$1
    getURL
elif [ $COMMAND == "getPort" ]; then
    COMPONENT_NAME=$1
    getPort
elif [ $COMMAND == "addOwnerReference" ]; then
    COMPONENT_NAME=$1
    APP_NAME=$2
    ODO_DEBUG_LOG=$3
    addOwnerReference
elif [ $COMMAND == "addProjectIDLabel" ]; then
    COMPONENT_NAME=$1
    APP_NAME=$2
    ODO_DEBUG_LOG=$3
    PROJECT_ID=$4
    addProjectIDLabel
elif [ $COMMAND == "updateCodewindLinkEnvs" ]; then
    PROJECT_DIRECTORY=$1
    updateCodewindLinkEnvs
fi
