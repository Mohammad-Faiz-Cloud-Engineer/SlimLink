const app = require('./app');
const config = require('./config');
const { initDb } = require('./db/index');

initDb().then(() => {
  app.listen(config.port, () => {
    console.log('SlimLink running at ' + config.baseUrl);
    console.log('Admin panel at ' + config.baseUrl + '/admin');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
