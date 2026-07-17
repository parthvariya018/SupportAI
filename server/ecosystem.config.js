// ecosystem.config.js — PM2 process configuration
// Usage:
//   pm2 start ecosystem.config.js              # start
//   pm2 start ecosystem.config.js --env prod   # start with prod env
//   pm2 reload ecosystem.config.js             # zero-downtime reload
//   pm2 save && pm2 startup                    # persist across reboots

module.exports = {
  apps: [
    {
      name: 'supportai-server',
      script: 'server.js',

      // Cluster mode: one worker per CPU core for horizontal scaling.
      // Use instances: 1 if you need sticky sessions (Socket.IO without Redis adapter).
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',

      // Restart policy
      autorestart:      true,
      watch:            false,   // never watch in production
      max_memory_restart: '512M',

      // Graceful shutdown: wait up to 10 s for in-flight requests to finish
      // before SIGKILL. Matches the 10 s timeout in server.js shutdown().
      kill_timeout:     10000,
      listen_timeout:   5000,
      shutdown_with_message: false,

      // Environment — base (development)
      env: {
        NODE_ENV: 'development',
        PORT:     5000,
      },

      // Environment — production (activated with --env prod)
      env_prod: {
        NODE_ENV: 'production',
        PORT:     5000,
      },

      // Logging
      out_file:   './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Source maps for readable stack traces
      source_map_support: false,
    },
  ],
};
