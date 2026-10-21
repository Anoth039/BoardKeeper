process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_QUIET = 'true';
process.env.TZ = 'Europe/Budapest';
process.env.JWT_SECRET = 'test_jwt_secret';

process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || '3306';
process.env.DB_USERNAME = process.env.TEST_DB_USERNAME || 'root';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? '';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'boardkeeper_test';
