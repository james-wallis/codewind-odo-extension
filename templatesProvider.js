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

const CODEWIND_ODO_EXTENSION_BASE_PATH = '/codewind-workspace/.extensions/codewind-odo-extension';
const MASTER_INDEX_JSON_FILE = CODEWIND_ODO_EXTENSION_BASE_PATH + '/templates/master-index.json';
const RECONCILED_INDEX_JSON_FILE = CODEWIND_ODO_EXTENSION_BASE_PATH + '/templates/index.json';
const JSON_FILE_URL = 'file://' + RECONCILED_INDEX_JSON_FILE;
const ODO_CATALOG_LIST_COMMAND = CODEWIND_ODO_EXTENSION_BASE_PATH + '/bin/odo catalog list components -o json';


module.exports = {
    getRepositories: async function() {
        // Read master-index.json of currently defined templates for OpenShift
        const data = await readFileAsync(MASTER_INDEX_JSON_FILE, 'utf8');
        const masterjson = JSON.parse(data);

        // Get the current list of components from the ODO command
        const { stdout } = await execAsync(ODO_CATALOG_LIST_COMMAND);
        const { items } = JSON.parse(stdout);
        const odocomponents = items.map(({ metadata: { name }}) => name);

        // Loop through current list of templates in master index.json and delete any language
        // not in component list returned by odo command
        // note: the master index.json is assumed to use same keywords for 'language' as odo uses for component 'name'
        const sanitisedComponents = masterjson.filter(({ language }) => odocomponents.includes(language));

        await writeFileAsync(RECONCILED_INDEX_JSON_FILE, JSON.stringify(sanitisedComponents, null, 4), 'utf8');

        // Return a link to the updated index.json index
        const repos = [{
            name: 'OpenShift templates',
            description: 'The set of templates for new OpenShift projects in Codewind.',
            url: JSON_FILE_URL,
            projectStyles: ['OpenShift'],
        }];
        return repos;
    },

    getProjectTypes: async function() {
        // Read master-index.json of currently defined templates for OpenShift
        const data = await readFileAsync(MASTER_INDEX_JSON_FILE, 'utf8');
        const masterjson = JSON.parse(data);

        // Run odo command to get list of catalog components available for cluster, then compare with mater index.json
        // to generate supported language for project bind
        const { stdout } = await execAsync(ODO_CATALOG_LIST_COMMAND);
        const { items } = JSON.parse(stdout);
        const odocomponents = items.map(({ metadata: { name }}) => name);

        // Loop through current list of templates in master index.json and add any language
        // that in component list returned by odo command
        // note: the master index.json is assumed to use same keywords for 'language' as odo uses for component 'name'
        const projectTypes = masterjson.filter(({ language }) => odocomponents.includes(language))
            .map(({ language, description }) => ({
                projectType: 'odo',
                projectSubtypes: {
                    label: 'OpenShift component',
                    items: [{
                        id: `OpenShift/${language}`,
                        label: `OpenShift ${language}`,
                        description,
                    }],
                },
            }));
        return projectTypes;
    }
}
