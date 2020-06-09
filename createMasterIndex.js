const https = require('https');
const path = require('path');
const { promisify } = require('util');
const { writeFile } = require('fs');

const asyncWriteFile = promisify(writeFile);

const indexJsonPath = path.join(__dirname, 'templates', 'index.json');
const masterIndexJsonPath = path.join(__dirname, 'templates', 'master-index.json');

function getTemplates() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://raw.githubusercontent.com/odo-devfiles/registry/master/devfiles/index.json', (res) => {
      res.setEncoding('utf8');
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        resolve(JSON.parse(responseBody));
      });
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

const convertToCodewindTemplates = devfileIndex => {
  const codewindTemplates = devfileIndex.map(({ name, displayName, description, language, projectType }) => ({
    displayName: `OpenShift Devfiles ${displayName}`,
    description,
    language: getTemplateLanguage(language, projectType),
    projectType: 'odo-devfile',
    projectStyle: 'OpenShift Devfiles',
    location: getTemplateLocation(name), // devfile didn't have a location so try without
  }));
  return codewindTemplates.filter(({ location }) => location !== null);
}

const getTemplateLocation = name => {
  switch (name) {
    case 'openLiberty':
      return 'https://github.com/odo-devfiles/openliberty-ex';
    case 'nodejs':
      return 'https://github.com/odo-devfiles/nodejs-ex';
    case 'springBoot':
      return 'https://github.com/odo-devfiles/springboot-ex';
    default:
      return null;
  }
};

// Odo Devfile Components:
// NAME                 DESCRIPTION                            REGISTRY                   SUPPORTED
// java-openliberty     Open Liberty microservice in Java      DefaultDevfileRegistry     YES
// nodejs               Stack with NodeJS 10                   DefaultDevfileRegistry     YES
// java-spring-boot     Spring Boot® using Java                DefaultDevfileRegistry     YES
// maven                Upstream Maven and OpenJDK 11          DefaultDevfileRegistry     YES
// quarkus              Upstream Quarkus with Java+GraalVM     DefaultDevfileRegistry     YES
const getTemplateLanguage = (language, projectType) => {
  if (language === 'java') {
    if (projectType === 'spring') {
      return 'java-spring-boot';
    } else {
      // open-liberty has a projectType of Dockre
      return 'java-openliberty'
    }
  } else {
    return 'nodejs';
  }
}

const saveToIndexJson = async templates => {
  await asyncWriteFile(indexJsonPath, JSON.stringify(templates, null, 4));
  await asyncWriteFile(masterIndexJsonPath, JSON.stringify(templates, null, 4));
}

const main = async() => {
  const devfileIndex = await getTemplates();
  const codewindTemplates = await convertToCodewindTemplates(devfileIndex);
  await saveToIndexJson(codewindTemplates);
  console.log(`Successfully written new index.json (${indexJsonPath})`);
}

main().catch(err => console.log(err));
