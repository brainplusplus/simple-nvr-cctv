const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const errors = [];

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function fail(message) {
  errors.push(message);
}

function extractGoVersion(relativePath) {
  const match = read(relativePath).match(/^go\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/m);

  if (!match) {
    fail(`Missing Go version in ${relativePath}.`);
    return null;
  }

  return match[1];
}

function extractDockerBaseVersion(relativePath, stageName) {
  const pattern = new RegExp(`^FROM\\s+golang:([0-9]+\\.[0-9]+(?:\\.[0-9]+)?)-alpine\\s+AS\\s+${stageName}$`, 'm');
  const match = read(relativePath).match(pattern);

  if (!match) {
    fail(`Missing ${stageName} Go base image in ${relativePath}.`);
    return null;
  }

  return match[1];
}

function majorMinor(version) {
  return version.split('.').slice(0, 2).join('.');
}

function expectEqual(actual, expected, description) {
  if (actual !== expected) {
    fail(`${description}: expected ${expected}, got ${actual}.`);
  }
}

const backendGo = extractGoVersion('apps/backend/go.mod');
const proxyGo = extractGoVersion('apps/reverse-proxy/go.mod');

const backendDockerGo = extractDockerBaseVersion('apps/backend/Dockerfile', 'builder');
const proxyDockerGo = extractDockerBaseVersion('apps/reverse-proxy/Dockerfile', 'proxy-builder');
const combinedProxyDockerGo = extractDockerBaseVersion('Dockerfile.combined', 'proxy-builder');

if (backendGo && backendDockerGo) {
  expectEqual(majorMinor(backendDockerGo), majorMinor(backendGo), 'apps/backend/Dockerfile builder Go version mismatch');
}

if (proxyGo && proxyDockerGo) {
  expectEqual(majorMinor(proxyDockerGo), majorMinor(proxyGo), 'apps/reverse-proxy/Dockerfile builder Go version mismatch');
}

if (proxyGo && combinedProxyDockerGo) {
  expectEqual(majorMinor(combinedProxyDockerGo), majorMinor(proxyGo), 'Dockerfile.combined proxy-builder Go version mismatch');
}

const compose = read('docker-compose.yml');

if (!compose.includes('- RECORDINGS_ROOT=${RECORDINGS_ROOT:-/app/recordings}')) {
  fail('docker-compose.yml must keep RECORDINGS_ROOT pointed at /app/recordings for container deployments.');
}

if (!compose.includes('- recordings_data:/app/recordings')) {
  fail('docker-compose.yml must mount a persistent named volume at /app/recordings.');
}

if (!/^volumes:\s*\n\s+recordings_data:\s*$/m.test(compose)) {
  fail('docker-compose.yml must declare the recordings_data named volume.');
}

if (errors.length > 0) {
  console.error('Deployment config check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Deployment config check passed.');
