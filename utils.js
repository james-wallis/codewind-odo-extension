const { exec } = require('child_process');
const { promisify } = require('util');
const { readFile, writeFile } = require('fs');
const http = require('http');
const https = require('https');

const execAsync = promisify(exec);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

const ODO_CATALOG_LIST_COMMAND = 'catalog list components -o json';

async function readJSON(filepath) {
  const data = await readFileAsync(filepath, 'utf8');
  const parsedData = JSON.parse(data);
  return parsedData;
}

async function writeJSON(filepath, contents) {
  const json = JSON.stringify(contents, null, 4);
  await writeFileAsync(filepath, json, 'utf8');
}

async function runOdoCommand(odoCommand, odoPreferenceLocation) {
  return execAsync(odoCommand, { env: { ...process.env, 'GLOBALODOCONFIG': odoPreferenceLocation }});
}

async function fetchOdoComponentTemplates(odoLocation, odoPreferenceLocation) {
  const devfiles = await fetchOdoComponents(odoLocation, odoPreferenceLocation);
  if (devfiles.length === 0) {
    throw new Error(`No devfiles returned from odo`)
  }
  const supportedDevfiles = devfiles.filter((devfile) => {
    // In the future the Support field will be taken out so if its not there, assume the devfile is supported
    return !devfile.hasOwnProperty('Support') || devfile.Support === true;
  });
  const templates = await convertDevfilesToTemplates(supportedDevfiles, odoLocation, odoPreferenceLocation);
  return templates;
  // {
  //   displayName: 'OpenShift Devfiles NodeJS Express Web Application',
  //   description: 'Stack with NodeJS 10',
  //   language: 'nodejs',
  //   projectType: 'odo-devfile',
  //   projectStyle: 'OpenShift Devfiles',
  //   location: 'https://github.com/odo-devfiles/nodejs-ex'
  // },
}

async function fetchOdoComponents(odoLocation, odoPreferenceLocation) {
  const odoCommand = `${odoLocation} ${ODO_CATALOG_LIST_COMMAND}`;
  const { stdout } = await runOdoCommand(odoCommand, odoPreferenceLocation);
  const { devfileItems } = JSON.parse(stdout);
  return devfileItems;
}

async function convertDevfilesToTemplates(devfiles, odoLocation, odoPreferenceLocation) {
  const templates = await Promise.all(devfiles.map(devfile => createTemplateFromDevfile(devfile, odoLocation, odoPreferenceLocation)));
  return templates.filter(template => template !== null);
}

async function createTemplateFromDevfile(devfile, odoLocation, odoPreferenceLocation) {
  const { Name, DisplayName, Description, Link: path, Registry: { URL: host } } = devfile;
  const gitLocation = await getLocationFromDescribeComponent(odoLocation, odoPreferenceLocation, Name);

  if (!gitLocation) {
    return null;
  }

  const location = (gitLocation.endsWith('.git')) ? gitLocation.slice(0, gitLocation.length - 4) : gitLocation;

  const template = {
    displayName: `OpenShift Devfiles ${DisplayName}`,
    description: Description,
    language: Name, // Devfile Name is near enough to a language
    projectType: 'odo-devfile',
    projectStyle: 'OpenShift Devfiles',
    location,
  }

  return template;
}

async function getLocationFromDescribeComponent(odoLocation, odoPreferenceLocation, component) {
  const odoCommand = `${odoLocation} catalog describe component ${component} -o json`;
  const { stdout } = await runOdoCommand(odoCommand, odoPreferenceLocation);
  const { Data } = JSON.parse(stdout);
  if (!Data.projects || Data.projects.length === 0) {
    return null;
  }

  for (const project of Data.projects) {
    if (project.git && project.git.location) {
      return project.git.location;
    }
  }
}

module.exports = {
  readJSON,
  writeJSON,
  runOdoCommand,
  fetchOdoComponentTemplates,
}
