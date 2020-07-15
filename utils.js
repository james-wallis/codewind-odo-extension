const { exec } = require('child_process');
const { promisify } = require('util');
const { readFile, writeFile } = require('fs');
const http = require('http');
const https = require('https');

const execAsync = promisify(exec);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

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

function asyncHttpRequest(url) {
  return new Promise(function (resolve, reject) {
    const req = https.get(url, (res) => {
      res.body = '';
      // Listen for response events.
      res.on('error', (err) => {
        return reject(err);
      });
      res.on('data', (data) => {
        res.body += data
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(res);
        }
        return resolve(res.body);
      });
    });
    // Listen for request events.
    req.on('error', (err) => {
      return reject(err);
    });
    req.end();
  });
}

async function fetchOdoComponentTemplates(odoCommand, odoPreferenceLocation) {
  const devfiles = await fetchOdoComponents(odoCommand, odoPreferenceLocation);
  if (devfiles.length === 0) {
    throw new Error(`No devfiles returned from the command: ${odoCommand}`)
  }
  const supportedDevfiles = devfiles.filter((devfile) => {
    // In the future the Support field will be taken out so if its not there, assume the devfile is supported
    return !devfile.hasOwnProperty('Support') || devfile.Support === true;
  });
  const templates = await convertDevfilesToTemplates(supportedDevfiles);
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

async function fetchOdoComponents(odoCommand, odoPreferenceLocation) {
  const { stdout } = await runOdoCommand(odoCommand, odoPreferenceLocation);
  const { devfileItems } = JSON.parse(stdout);
  return devfileItems;
}

async function convertDevfilesToTemplates(devfiles) {
  const templates = await Promise.all(devfiles.map(createTemplateFromDevfile));
  return templates.filter(template => template !== null);
}

async function createTemplateFromDevfile(devfile) {
  const { Name, DisplayName, Description, Link: path, Registry: { URL: host } } = devfile;
    const yaml = await asyncHttpRequest(`${host}${path}`);
    const gitLocation = await getLocationFromDevfileYaml(yaml);

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

async function getLocationFromDevfileYaml(yaml) {
  const { stdout: types } = await execAsync('echo "$yaml" | yq r - projects[*].source.type', { env: { 'yaml': yaml }});
  const splitTypes = types.split('\n');
  // Use .includes to handle 'git' and '- git'
  const gitLocationIndex = splitTypes.findIndex(type => type.includes('git'));
  if (gitLocationIndex === -1) {
    return null;
  }
  const { stdout } = await execAsync(`echo "$yaml" | yq r - projects[${gitLocationIndex}].source.location`, { env: { 'yaml': yaml }});
  const [location] = stdout.split('\n');
  return location;
}

module.exports = {
  readJSON,
  writeJSON,
  runOdoCommand,
  fetchOdoComponentTemplates,
}
