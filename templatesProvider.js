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

const { exec } = require('child_process');
const { promisify } = require('util');
const { readFile, writeFile } = require('fs');

const execAsync = promisify(exec);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

const CODEWIND_ODO_EXTENSION_BASE_PATH = '/codewind-workspace/.extensions/codewind-odo-extension-devfile';
const MASTER_INDEX_JSON_FILE = CODEWIND_ODO_EXTENSION_BASE_PATH + '/templates/master-index.json';
const RECONCILED_INDEX_JSON_FILE = CODEWIND_ODO_EXTENSION_BASE_PATH + '/templates/index.json';
const JSON_FILE_URL = 'file://' + RECONCILED_INDEX_JSON_FILE;
const ODO_CATALOG_LIST_COMMAND = CODEWIND_ODO_EXTENSION_BASE_PATH + '/bin/odo catalog list components -o json';
const ODO_SET_EXPERIMENTAL_COMMAND = CODEWIND_ODO_EXTENSION_BASE_PATH + '/bin/odo preference set experimental true -f';


module.exports = {
    getRepositories: async function() {
        // Enable ODO experimental
        await execAsync(ODO_SET_EXPERIMENTAL_COMMAND);

        // Read master-index.json of currently defined templates for OpenShift
        const data = await readFileAsync(MASTER_INDEX_JSON_FILE, 'utf8');
        const masterjson = JSON.parse(data);
        await writeFileAsync(RECONCILED_INDEX_JSON_FILE, JSON.stringify(masterjson, null, 4), 'utf8');

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
        const projectTypes = [];
        // Read master-index.json of currently defined templates for OpenShift
        const data = await readFileAsync(MASTER_INDEX_JSON_FILE, 'utf8');
        const masterjson = JSON.parse(data);

        // Loop through current list of templates in master index.json
        // note: the master index.json is assumed to use same keywords for 'language' as odo uses for component 'name'
        const projectTypes = masterjson.map(({ language, description }) => ({
            projectType: 'odo',
            projectSubtypes: {
                label: 'OpenShift component',
                items: [{
                    id: `OpenShift/${language}`,
                    label: `OpenShift ${language}`,
                    description,
                }]
            }
        }));
        return projectTypes;
    }
}
