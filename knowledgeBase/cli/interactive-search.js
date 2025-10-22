#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');

// Set up module resolution for TypeScript files
require('ts-node/register');
require('dotenv').config();

// Run the TypeScript file
require(path.join(__dirname, 'interactive-search.ts'));
