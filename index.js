// provides tactical IDM API
require('dotenv').config();

const GoodWinston = require('good-winston');
const Hapi = require('@hapi/hapi');

const serverPlugins = {
  blipp: require('blipp'),
  hapiAuthJwt2: require('hapi-auth-jwt2'),
  good: require('@hapi/good')
};

const config = require('./config');

const { logger } = require('./src/logger');
const goodWinstonStream = new GoodWinston({ winston: logger });

const server = new Hapi.Server(config.server);

const validateJWT = (decoded, request, h) => {
  logger.info(request.path);
  logger.info(request.payload);
  logger.info('CALL WITH TOKEN');
  logger.info(decoded);
  // TODO: JWT tokens to DB...
  // do your checks to see if the person is valid

  const isValid = !!decoded.id;
  const message = isValid ? 'huzah... JWT OK' : 'boo... JWT failed';
  logger.info(message);
  return { isValid };
};

const initGood = async () => {
  await server.register({
    plugin: serverPlugins.good,
    options: {
      ...config.good,
      reporters: {
        winston: [goodWinstonStream]
      }
    }
  });
};

const initBlipp = async () => {
  await server.register({
    plugin: serverPlugins.blipp,
    options: config.blipp
  });
};

const configureJwtStrategy = () => {
  server.auth.strategy('jwt', 'jwt', {
    key: process.env.JWT_SECRET, // Never Share your secret key
    validate: validateJWT, // validate function defined above
    verifyOptions: {}, // pick a strong algorithm
    verify: validateJWT
  });

  server.auth.default('jwt');
};

const init = async () => {
  initGood();
  initBlipp();

  await server.register({ plugin: serverPlugins.hapiAuthJwt2 });

  configureJwtStrategy();

  // load routes
  server.route(require('./src/routes/idm'));

  if (!module.parent) {
    await server.start();
    const name = process.env.SERVICE_NAME;
    const uri = server.info.uri;
    server.log('info', `Service ${name} running at: ${uri}`);
  }
};

process.on('unhandledRejection', err => {
  logger.error(err);
  process.exit(1);
});

init();

module.exports = server;
