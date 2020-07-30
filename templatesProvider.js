/*******************************************************************************
 *
 * Copyright (c) 2019 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *
 *******************************************************************************/

'use strict';

const { promisify } = require('util');
const { readFile } = require('fs');

const { readJSON, runOdoCommand, writeJSON, fetchOdoComponentTemplates } = require('./utils');

const readFileAsync = promisify(readFile);

const DEVELOPMENT = process.env.NODE_ENV === 'test';

const CODEWIND_ODO_EXTENSION_BASE_PATH = (DEVELOPMENT) ? '.'  : '/codewind-workspace/.extensions/codewind-odo-extension-devfile';
const MASTER_INDEX_JSON_FILE = CODEWIND_ODO_EXTENSION_BASE_PATH + '/templates/master-index.json';
const RECONCILED_INDEX_JSON_FILE = CODEWIND_ODO_EXTENSION_BASE_PATH + '/templates/index.json';
const JSON_FILE_URL = 'file://' + RECONCILED_INDEX_JSON_FILE;
const ODO_LOCATION = (DEVELOPMENT) ? 'odo' : CODEWIND_ODO_EXTENSION_BASE_PATH + '/bin/odo';
const ODO_SET_EXPERIMENTAL_COMMAND = ODO_LOCATION + ' preference set experimental true -f';
const ODO_PREFERENCE_DIR = (DEVELOPMENT) ? `${process.env.HOME}/.odo` : '/root/.odo'
const DEVFILE_PREFERENCE = ODO_PREFERENCE_DIR + '/devfile-preference.yaml';


module.exports = {
    getRepositories: async function() {
        // Enable ODO experimental
        await runOdoCommand(ODO_SET_EXPERIMENTAL_COMMAND, DEVFILE_PREFERENCE);

        const odoTemplates = await fetchOdoComponentTemplates(ODO_LOCATION, DEVFILE_PREFERENCE);
        await writeJSON(RECONCILED_INDEX_JSON_FILE, odoTemplates);

        // Return a link to the updated index.json index
        const repos = [{
            name: 'OpenShift Devfile templates',
            description: 'The set of templates for new OpenShift Devfile projects in Codewind.',
            url: JSON_FILE_URL,
            projectStyles: ['OpenShift Devfiles'],
        }];
        return repos;
    },

    getProjectTypes: async function() {
        // Read master-index.json of currently defined templates for OpenShift
        const data = await readFileAsync(RECONCILED_INDEX_JSON_FILE, 'utf8');
        const masterjson = JSON.parse(data);

        // Loop through current list of templates in master index.json
        // note: the master index.json is assumed to use same keywords for 'language' as odo uses for component 'name'
        const projectTypes = masterjson.map(({ language, description }) => ({
            projectType: 'odo-devfile',
            projectSubtypes: {
                label: 'OpenShift Devfile component',
                items: [{
                    id: `OpenShiftDevfile/${language}`,
                    label: `OpenShift Devfile ${language}`,
                    description,
                }]
            }
        }));
        return projectTypes;
    }
}
