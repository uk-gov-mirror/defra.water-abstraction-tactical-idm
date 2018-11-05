/**
 * Test verification process
 * - Create entity
 * - Create company
 * - Create unverified document headers linked to entity/company
 * - Create verification code - update documents with ID
 * - Verify with auth code
 * - Update documents with verification ID to verified status
 */
'use strict';
const uuidv4 = require('uuid/v4');
const Lab = require('lab');
const lab = exports.lab = Lab.script();

const { expect } = require('code');
const server = require('../index');

// A user is always created with testEmailOne as part of the beforeEach.
const testEmailOne = 'test1@example.com';

// This is reserved when needing to add an alternative/extra user
const testEmailTwo = 'test2@example.com';

const createRequest = (method = 'GET', url = '/idm/1.0/user') => ({
  method,
  url,
  headers: { Authorization: process.env.JWT_TOKEN }
});

const createDeleteRequest = email => createRequest('DELETE', `/idm/1.0/user/${email}`);
const createGetRequest = id => createRequest('GET', `/idm/1.0/user/${id}`);

async function deleteTestUsers () {
  // Find user by email
  const requests = [
    createDeleteRequest(testEmailOne),
    createDeleteRequest(testEmailTwo)
  ].map(request => server.inject(request));
  await Promise.all(requests);
}

const createTestUser = async (userName = testEmailOne, application = 'water_vml') => {
  const request = createRequest('POST');
  request.payload = {
    user_name: userName,
    application,
    password: uuidv4()
  };

  return server.inject(request);
};

lab.experiment('Test users API', () => {
  // Always add the basic test user to the database before each
  // to simplify GET based tests
  lab.beforeEach(async ({ context }) => {
    await deleteTestUsers();
    const response = await createTestUser();
    const payload = JSON.parse(response.payload);
    context.userId = payload.data.user_id;
  });

  lab.after(async () => {
    await deleteTestUsers();
  });

  lab.test('The API should create a user', async ({ context }) => {
    const res = await createTestUser(testEmailTwo);
    expect(res.statusCode).to.equal(201);

    const payload = JSON.parse(res.payload);

    expect(payload.error).to.equal(null);
    expect(payload.data.user_id).to.be.a.number();
    expect(payload.data.user_name).to.equal(testEmailTwo);
    expect(payload.data.date_created).to.be.a.string();
    expect(payload.data.date_updated).to.be.a.string();
  });

  lab.test('The API should get a user by ID', async ({ context }) => {
    const request = createGetRequest(context.userId);
    const response = await server.inject(request);
    expect(response.statusCode).to.equal(200);

    // Check payload
    const { error, data } = JSON.parse(response.payload);

    expect(error).to.equal(null);
    expect(data.user_name).to.equal(testEmailOne);
  });

  lab.test('The API should get a user by email address', async ({ context }) => {
    const request = createGetRequest(testEmailOne);
    const response = await server.inject(request);
    expect(response.statusCode).to.equal(200);

    const payload = JSON.parse(response.payload);
    expect(payload.error).to.equal(null);
    expect(payload.data.user_id).to.equal(context.userId);
  });

  lab.test('The API should get a list of users', async () => {
    const request = createRequest();
    const response = await server.inject(request);
    expect(response.statusCode).to.equal(200);

    const payload = JSON.parse(response.payload);
    expect(payload.error).to.equal(null);
    expect(payload.data).to.be.an.array();
  });

  lab.test('It is not be possible to use the same email with one application', async () => {
    await createTestUser(testEmailTwo, 'water_vml');
    const response = await createTestUser(testEmailTwo, 'water_vml');
    expect(response.statusCode).to.equal(400);
  });

  lab.test('It is possible to use the same email with across applications', async () => {
    const createVmlResponse = await createTestUser(testEmailTwo, 'water_vml');
    const createAdminResponse = await createTestUser(testEmailTwo, 'water_admin');
    expect(createVmlResponse.statusCode).to.equal(201);
    expect(createAdminResponse.statusCode).to.equal(201);
  });
});