# Performance Platform dashboard admin

This is a Node.js app that provides an interface for editing [Performance Platform][perfplat]
dashboard configuration.

It runs locally on your machine, modifying and deploying the [spotlight-config][] repository.

[perfplat]: https://www.gov.uk/performance
[spotlight-config]: https://github.com/alphagov/spotlight-config

## Running

1. Install Node.js
2. Run `npm install` to install dependencies
3. Setup a config.json file (see [config.json.example](config.json.example))
4. Run `npm start` to start the application
5. Visit http://localhost:3000/ in your browser
