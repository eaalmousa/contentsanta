// Vercel Serverless Function Entry Point
// This wraps the Express app for serverless execution

// Import the built Express app
const path = require('path');
const express = require('express');

// Create Express app instance
const app = express();

// In production, serve static files from dist/public
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist', 'public');
  app.use(express.static(distPath));
}

// Import and register all routes
// Note: This assumes your routes are exported from the build
try {
  const serverModule = require('../dist/index.cjs');
  // If the server exports the app, use it
  if (serverModule.app) {
    module.exports = serverModule.app;
  } else {
    // Otherwise, we need to manually set up routes
    module.exports = app;
  }
} catch (error) {
  console.error('Failed to load server module:', error);
  module.exports = app;
}
