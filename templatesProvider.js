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
const execAsync = promisify(exec);
const os = require('os');
const fs = require('fs');


const CODEWIND_ODO_EXTENSION_BASE_PATH = '/codewind-workspace/.extensions/codewind-odo-extension';
const MASTER_INDEX_JSON_FILE = CODEWIND_ODO_EXTENSION_BASE_PATH + '/templates/master-index.json';
const RECONCILED_INDEX_JSON_FILE = CODEWIND_ODO_EXTENSION_BASE_PATH + '/templates/index.json';
const JSON_FILE_URL = 'file://' + RECONCILED_INDEX_JSON_FILE;
const ODO_CATALOG_LIST_COMMAND = CODEWIND_ODO_EXTENSION_BASE_PATH + '/bin/odo catalog list components -o json';
const ODO_SET_EXPERIMENTAL_COMMAND = CODEWIND_ODO_EXTENSION_BASE_PATH + '/bin/odo preference set experimental true -f';


module.exports = {
    getRepositories: async function() {
        // Enable ODO experimental
        try {
            const output = await execAsync(ODO_SET_EXPERIMENTAL_COMMAND);
            console.log('*** odo pref output ', output);
        } catch(err) {
            console.log('*** odo pref err ', err);
        }
        return new Promise((resolve, reject) => {

            // Read master-index.json of currently defined templates for OpenShift
            fs.readFile(MASTER_INDEX_JSON_FILE, 'utf8', function (err, data) {
                if (err)
                    return reject(err);

                const masterjson = JSON.parse(data);

                // Run odo command to get list of catalog components available for cluster, then compare with mater index.json
                // to generate updated index.json used for project creation
                const odocomponents = [];
                exec(ODO_CATALOG_LIST_COMMAND, (err, stdout) => {
                    if (err)
                        return reject(err);

                    const componentsjson = JSON.parse(stdout);

                    for (const component of componentsjson.items) {
                        odocomponents.push(component.metadata.name);
                    }

                    // Loop through current list of templates in master index.json and delete any language 
                    // not in component list returned by odo command
                    // note: the master index.json is assumed to use same keywords for 'language' as odo uses for component 'name'
                    for(var i = 0; i < masterjson.length; i++) {
                        if ( !odocomponents.includes(masterjson[i].language) ) {
                            masterjson.splice(i,1);
                        }
                    }

                    // Write out reconciled index.json file
                    const reconciledjsoncontent = JSON.stringify(masterjson, null, 3);
                    try {
                        fs.writeFileSync(RECONCILED_INDEX_JSON_FILE, reconciledjsoncontent, 'utf8');
                    }
                    catch (e) {
                        return reject(e);
                    }
                });
            });
            
            // Return a link to the updated index.json index
            const repos = [];
            const projectStylesArr = [];
            projectStylesArr.push('OpenShift')
            repos.push({
                name: 'OpenShift templates',
                description: 'The set of templates for new OpenShift projects in Codewind.',
                url: JSON_FILE_URL,
                projectStyles: projectStylesArr
            });
            resolve(repos);
        });
    },

    getProjectTypes: async function() {
        return new Promise((resolve, reject) => {
            const projectTypes = [];

            // Read master-index.json of currently defined templates for OpenShift
            fs.readFile(MASTER_INDEX_JSON_FILE, 'utf8', function (err, data) {
                if (err)
                    return reject(err);
        
                const masterjson = JSON.parse(data);

                // Run odo command to get list of catalog components available for cluster, then compare with mater index.json
                // to generate supported language for project bind
                const odocomponents = [];
                exec(ODO_CATALOG_LIST_COMMAND, (err, stdout) => {
                    if (err)
                        return reject(err);
    
                    const componentsjson = JSON.parse(stdout);

                    for (const component of componentsjson.items) {
                        odocomponents.push(component.metadata.name);
                    }

                    // Loop through current list of templates in master index.json and add any language 
                    // that in component list returned by odo command
                    // note: the master index.json is assumed to use same keywords for 'language' as odo uses for component 'name'
                    for(var i = 0; i < masterjson.length; i++) {
                        if ( !odocomponents.includes(masterjson[i].language) ) {
                            continue;
                        } else {
                            projectTypes.push({
                                projectType: 'odo',
                                projectSubtypes: {
                                    label: 'OpenShift component',
                                    items: [{
                                        id: `OpenShift/${masterjson[i].language}`,
                                        label: `OpenShift ${masterjson[i].language}`,
                                        description: masterjson[i].description
                                    }]
                                }
                            });
                        }
                    }
                    resolve(projectTypes);
                });
            });
        });
    }
}
