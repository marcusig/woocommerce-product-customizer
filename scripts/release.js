const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const args = require('minimist')(process.argv.slice(2));
const version = args.v;
console.log( version );
if (!version) {
  console.error('❌ Please provide a version with -v');
  process.exit(1);
}

// Paths
const distDira = path.resolve(__dirname);
const distDir = path.resolve(__dirname, '../dist');
const svnTrunk = path.resolve(__dirname, '../../../../repository/product-configurator-for-woocommerce/trunk');
const repoUrl = 'http://plugins.svn.wordpress.org/product-configurator-for-woocommerce';

console.log( distDira );
console.log( svnTrunk );
console.log(`🚚 Copying dist → trunk`);
fs.emptyDirSync(svnTrunk);
fs.copySync(distDir, svnTrunk);

// Detect new/deleted files
console.log('🔍 Running svn add/delete');
execSync(`svn add --force "${svnTrunk}" --auto-props --parents --depth infinity`, { stdio: 'inherit' });
execSync(`svn status "${svnTrunk}" | grep '^!' | awk '{print $2}' | xargs -r svn delete`, { shell: '/bin/bash', stdio: 'inherit' });

// Dry run
// console.log(`svn commit "${svnTrunk}" -m "v${version}"`);
// console.log(`svn copy ${repoUrl}/trunk ${repoUrl}/tags/${version} -m "Tagging version ${version}"`);

// Commit
console.log(`✅ Committing version ${version}`);
execSync(`svn commit "${svnTrunk}" -m "v${version}"`, { stdio: 'inherit' });

// Tag
console.log(`🏷️  Tagging version ${version}`);
execSync(`svn copy ${repoUrl}/trunk ${repoUrl}/tags/${version} -m "Tagging version ${version}"`, { stdio: 'inherit' });

console.log(`🎉 Done! Plugin tagged as ${version}`);
