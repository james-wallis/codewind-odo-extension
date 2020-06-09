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
ODO_EXTENSION_DIR=/codewind-workspace/.extensions/codewind-odo-extension

ROOT=$1
PROJECT_ID=$2
COMMAND=$3
COMPONENT_TYPE=$4
COMPONENT_NAME=$5
FOLDER_NAME=$6
AUTO_BUILD_ENABLED=$7

WORKSPACE=/codewind-workspace
LOG_FOLDER=$WORKSPACE/.logs/$FOLDER_NAME
ODO_BUILD_LOG=$LOG_FOLDER/odo.build.log
ODO_APP_LOG=$LOG_FOLDER/odo.app.log
ODO_DEBUG_LOG=$LOG_FOLDER/odo.debug.log

# echo "*** ODO" |& tee -a $ODO_DEBUG_LOG
# echo "*** PWD = $PWD" |& tee -a $ODO_DEBUG_LOG
# echo "*** ROOT = $ROOT" |& tee -a $ODO_DEBUG_LOG
# echo "*** PROJECT_ID = $PROJECT_ID" |& tee -a $ODO_DEBUG_LOG
# echo "*** COMMAND = $COMMAND" |& tee -a $ODO_DEBUG_LOG
# echo "*** COMPONENT_TYPE = $COMPONENT_TYPE" |& tee -a $ODO_DEBUG_LOG
# echo "*** COMPONENT_NAME = $COMPONENT_NAME" |& tee -a $ODO_DEBUG_LOG
# echo "*** LOG_FOLDER = $LOG_FOLDER" |& tee -a $ODO_DEBUG_LOG
# echo "*** AUTO_BUILD_ENABLED = $AUTO_BUILD_ENABLED" |& tee -a $ODO_DEBUG_LOG

# General setup
source /file-watcher/scripts/constants.sh
source $ODO_EXTENSION_DIR/scripts/odo-constants.sh
set -o pipefail
util=/file-watcher/scripts/util.sh
odo=$ODO_EXTENSION_DIR/scripts/odo-functions.sh
odoUtil=$ODO_EXTENSION_DIR/scripts/odo-util.sh

# Go into the project directory
cd $ROOT

function create() {
	echo "Touching odo build log file: $ODO_BUILD_LOG" |& tee -a $ODO_DEBUG_LOG
	touch $ODO_BUILD_LOG
	echo "Triggering log file event for: $ODO_BUILD_LOG" |& tee -a $ODO_DEBUG_LOG
	$util newLogFileAvailable $PROJECT_ID "build"

	echo -e "\nCreating, building and deploying odo component" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS $BUILD_CREATE_INPROGRESS_MSG |& tee -a $ODO_DEBUG_LOG
	echo -e "\nStep 1 of 5:" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
	$odo create $COMPONENT_TYPE $COMPONENT_NAME $ODO_BUILD_LOG $ODO_DEBUG_LOG
	if [ $? -ne 0 ]; then
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED $BUILD_CREATE_FAIL_MSG |& tee -a $ODO_DEBUG_LOG
		exit 3
	fi

	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS $BUILD_PUSH_INPROGRESS_MSG |& tee -a $ODO_DEBUG_LOG
	echo -e "\nStep 2 of 5:" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
	$odo push $COMPONENT_NAME $ODO_BUILD_LOG $ODO_DEBUG_LOG
	if [ $? -ne 0 ]; then
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED $BUILD_PUSH_FAIL_MSG |& tee -a $ODO_DEBUG_LOG
		exit 3
	fi

	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS $BUILD_URL_INPROGRESS_MSG |& tee -a $ODO_DEBUG_LOG
	echo -e "\nStep 3 of 5:" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
	$odo url $COMPONENT_NAME $ODO_BUILD_LOG $ODO_DEBUG_LOG
	if [ $? -ne 0 ]; then
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED $BUILD_URL_FAIL_MSG |& tee -a $ODO_DEBUG_LOG
		exit 3
	fi

	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS $BUILD_URL_INPROGRESS_MSG |& tee -a $ODO_DEBUG_LOG
	echo -e "\nStep 4 of 5:" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG

	# The commands for project linking don't work in experimental mode so disable project links
	echo "- Project link disabled for odo experimental - skipping" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
	# $odoUtil updateCodewindLinkEnvs $ROOT

	if [ $? -ne 0 ]; then
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED $BUILD_URL_FAIL_MSG |& tee -a $ODO_DEBUG_LOG
		exit 3
	fi

	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS $BUILD_PUSH_INPROGRESS_MSG |& tee -a $ODO_DEBUG_LOG
	echo -e "\nStep 5 of 5:" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
	$odo push $COMPONENT_NAME $ODO_BUILD_LOG $ODO_DEBUG_LOG
	exitCode=$?
	imageLastBuild=$(($(date +%s)*1000))
	if [ $exitCode -eq 0 ]; then
		echo -e "\nSuccessfully created, built and deployed odo component\n" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
		$util updateBuildState $PROJECT_ID $BUILD_STATE_SUCCESS " " "$imageLastBuild" |& tee -a $ODO_DEBUG_LOG
	else
		echo -e "\nFailed to create or build or deploy odo component\n" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED $BUILD_PUSH_FAIL_MSG |& tee -a $ODO_DEBUG_LOG
		exit 3
	fi

	echo "Touching odo app log file: $ODO_APP_LOG" |& tee -a $ODO_DEBUG_LOG
	touch $ODO_APP_LOG
	echo "Triggering log file event for: $ODO_APP_LOG" |& tee -a $ODO_DEBUG_LOG
	$util newLogFileAvailable $PROJECT_ID "app"

	echo "Starting odo component" |& tee -a $ODO_DEBUG_LOG
	$util updateAppState $PROJECT_ID $APP_STATE_STOPPED |& tee -a $ODO_DEBUG_LOG
	APP_NAME=$($odoUtil getAppName)
	POD_NAME=$($odoUtil getPodName $COMPONENT_NAME $APP_NAME)
	kubectl logs -f $POD_NAME >> "$ODO_APP_LOG" &
	$util updateAppState $PROJECT_ID $APP_STATE_STARTING |& tee -a $ODO_DEBUG_LOG

	echo "Adding owner references for all resources deployed by odo" |& tee -a $ODO_DEBUG_LOG
	$odoUtil addOwnerReference $COMPONENT_NAME $APP_NAME $ODO_DEBUG_LOG
	if [ $? -eq 0 ]; then
		echo -e "\nSuccessfully added owner references for all resources deployed by odo\n" |& tee -a $ODO_DEBUG_LOG
	else
		echo -e "\nFailed to add owner references for all resources deployed by odo\n" |& tee -a $ODO_DEBUG_LOG
		exit 3
	fi

	echo "Adding projectID label for all resources deployed by odo" |& tee -a $ODO_DEBUG_LOG
	$odoUtil addProjectIDLabel $COMPONENT_NAME $APP_NAME $ODO_DEBUG_LOG $PROJECT_ID
	if [ $? -eq 0 ]; then
		echo -e "\nSuccessfully added projectID label for all resources deployed by odo\n" |& tee -a $ODO_DEBUG_LOG
	else
		echo -e "\nFailed to add projectID label for all resources deployed by odo\n" |& tee -a $ODO_DEBUG_LOG
		exit 3
	fi
}

function remove() {
	echo -e "\nRemoving odo component" |& tee -a $ODO_DEBUG_LOG
	echo -e "\nStep 1 of 2:" |& tee -a $ODO_DEBUG_LOG
	echo "Stopping monitor app log" |& tee -a $ODO_DEBUG_LOG
	APP_NAME=$($odoUtil getAppName)
	POD_NAME=$($odoUtil getPodName $COMPONENT_NAME $APP_NAME)
	pgrep -f "kubectl logs -f $POD_NAME" | xargs kill -9

	echo -e "\nStep 2 of 2:" |& tee -a $ODO_DEBUG_LOG
	$odo delete $COMPONENT_NAME $ODO_DEBUG_LOG
	if [ $? -eq 0 ]; then
		echo -e "\nSuccessfully removed odo component\n" |& tee -a $ODO_DEBUG_LOG
	else
		echo -e "\nFailed to remove odo component\n" |& tee -a $ODO_DEBUG_LOG
		exit 3
	fi
}

function update() {
	echo -e "\nUpdating odo component" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG

	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS $BUILD_URL_INPROGRESS_MSG |& tee -a $ODO_DEBUG_LOG
	echo -e "\nStep 1 of 2, Updating Codewind links:" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG

	# The commands for project linking don't work in experimental mode so disable project links
	echo "- Project link disabled for odo experimental - skipping" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
	# $odoUtil updateCodewindLinkEnvs $ROOT

	if [ $? -ne 0 ]; then
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED $BUILD_URL_FAIL_MSG |& tee -a $ODO_DEBUG_LOG
		exit 3
	fi

	$util updateBuildState $PROJECT_ID $BUILD_STATE_INPROGRESS $BUILD_PUSH_INPROGRESS_MSG
	echo -e "\nStep 2 of 2:" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
	$odo push $COMPONENT_NAME $ODO_BUILD_LOG $ODO_DEBUG_LOG
	exitCode=$?
	imageLastBuild=$(($(date +%s)*1000))
	if [ $exitCode -eq 0 ]; then
		echo -e "\nSuccessfully updated odo component\n" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
		$util updateBuildState $PROJECT_ID $BUILD_STATE_SUCCESS " " "$imageLastBuild"
	else
		echo -e "\nFailed to update odo component\n" |& tee -a $ODO_BUILD_LOG $ODO_DEBUG_LOG
		$util updateBuildState $PROJECT_ID $BUILD_STATE_FAILED $BUILD_PUSH_FAIL_MSG
		exit 3
	fi

	echo "Starting odo component" |& tee -a $ODO_DEBUG_LOG
	$util updateAppState $PROJECT_ID $APP_STATE_STARTING
}

# Create, build, deploy component to the OpenShift cluster
if [ "$COMMAND" == "create" ]; then
	create

# Update, build, deploy component to the OpenShift cluster
elif [ "$COMMAND" == "update" ]; then
	update

	if [ $? -ne 0 ]; then
		remove
		create
	fi

# Remove component from the OpenShift cluster
elif [ "$COMMAND" == "remove" ]; then
	remove

# Rebuild and deploy component to the OpenShift cluster
elif [ "$COMMAND" == "rebuild" ]; then
	remove
	create

# Get pod name
elif [ "$COMMAND" == "getPodName" ]; then
	APP_NAME=$($odoUtil getAppName)
	POD_NAME=$($odoUtil getPodName $COMPONENT_NAME $APP_NAME)
	echo $POD_NAME

# Get app name
elif [ "$COMMAND" == "getAppName" ]; then
	APP_NAME=$($odoUtil getAppName)
	echo $APP_NAME

# Get port
elif [ "$COMMAND" == "getPort" ]; then
	PORT=$($odoUtil getPort $COMPONENT_NAME)
	echo $PORT

# Get URL
elif [ "$COMMAND" == "getURL" ]; then
	URL=$($odoUtil getURL $COMPONENT_NAME)
	echo $URL
fi
