// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // If you’re using Reanimated:
      "react-native-reanimated/plugin",

      // Dotenv support for @env
      [
        "module:react-native-dotenv",
        {
          moduleName: "@env",
          path: ".env",
          allowUndefined: true
        }
      ]
    ]
  };
};
