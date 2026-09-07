// Migrations are bundled into the app as inlined strings: Metro does not
// resolve .sql files on its own, so drizzle/migrations.js imports them and
// this plugin turns each import into a literal at build time. See #10.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
