const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');
const { Octokit } = require('@octokit/rest');

const root = process.cwd();
const ignoreDirs = new Set(['node_modules', 'build', 'dist', 'coverage', '.git']);

async function listFiles(dir) {
  const result = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(root, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      result.push(...await listFiles(fullPath));
    } else if (entry.isFile()) {
      result.push(relPath);
    }
  }
  return result;
}

async function initRepo() {
  if (!fs.existsSync(path.join(root, '.git'))) {
    console.log('Initializing local Git repository...');
    await git.init({ fs, dir: root, defaultBranch: 'main' });
  } else {
    console.log('.git already exists, skipping init.');
  }

  const author = {
    name: 'Repo Automator',
    email: 'noreply@example.com',
  };

  const files = await listFiles(root);
  console.log(`Adding ${files.length} files to the repository...`);
  for (const filepath of files) {
    await git.add({ fs, dir: root, filepath });
  }

  const commitOid = await git.commit({
    fs,
    dir: root,
    author,
    message: 'Initial commit',
  });
  console.log(`Committed as ${commitOid}`);
}

async function createGithubRepo(repoName, isPrivate) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error('Missing GITHUB_TOKEN or GH_TOKEN environment variable.');
  }
  const octokit = new Octokit({ auth: token });
  const { data: user } = await octokit.rest.users.getAuthenticated();
  const owner = user.login;

  console.log(`Creating GitHub repository ${owner}/${repoName}...`);
  try {
    const response = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      private: isPrivate,
      description: 'Uploaded by automated repo creation script',
    });
    return response.data.clone_url;
  } catch (error) {
    if (error.status === 422 && error.message && error.message.includes('name already exists')) {
      console.log('Repository already exists. Using existing remote.');
      return `https://github.com/${owner}/${repoName}.git`;
    }
    throw error;
  }
}

async function addRemoteAndPush(remoteUrl) {
  console.log(`Configuring remote origin ${remoteUrl}...`);
  await git.setConfig({ fs, dir: root, path: 'remote.origin.url', value: remoteUrl });
  await git.setConfig({ fs, dir: root, path: 'remote.origin.fetch', value: '+refs/heads/*:refs/remotes/origin/*' });

  console.log('Pushing to origin/main...');
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  await git.push({
    fs,
    http,
    dir: root,
    remote: 'origin',
    ref: 'main',
    onAuth: () => ({ username: 'x-access-token', password: token }),
  });
  console.log('Push completed.');
}

async function main() {
  const repoName = process.argv[2];
  const visibility = process.argv[3] || 'private';
  if (!repoName) {
    console.error('Usage: node scripts/github-upload.cjs <repo-name> [private|public]');
    process.exit(1);
  }
  const isPrivate = visibility !== 'public';
  await initRepo();
  const remoteUrl = await createGithubRepo(repoName, isPrivate);
  await addRemoteAndPush(remoteUrl);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
