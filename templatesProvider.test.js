// Activate tests
process.env.NODE_ENV = 'test';

const assert = require('assert');
const { getRepositories, getProjectTypes } = require('./templatesProvider');
const { readJSON } = require('./utils');

async function testGetRepositories() {
  console.log('\n\nTest getRepositories\n');
    const repos = await getRepositories();
    testAssert(repos.length, 1);
    const { name, description, url, projectStyles } = repos[0];
    testAssert('OpenShift Devfile templates', name);
    testAssert('The set of templates for new OpenShift Devfile projects in Codewind.', description);
    testAssert('file://./templates/index.json', url);
    testAssert(1, projectStyles.length);
    testAssert('OpenShift Devfiles', projectStyles[0]);

    // Test that the index.json has been created and populated
    const [prefix, filePath] = url.split('//');
    const templates = await readJSON(filePath);
    testAssertNot(0, templates.length);
    console.log(JSON.stringify(templates, null, '\t'));
}

async function testGetProjectTypes() {
  console.log('\n\nTest getProjectTypes\n');
  const projectTypes = await getProjectTypes();
  testAssertNot(0, projectTypes.length);
}

async function test() {
  await testGetRepositories();
  await testGetProjectTypes();
}

function testAssert(want, got) {
  assert(want === got, `Wanted: ${want}, Got: ${got}`);
}

function testAssertNot(want, got) {
  assert(want !== got, `Wanted: ${want}, Got: ${got}`);
}

test().catch(err => console.error(err));


