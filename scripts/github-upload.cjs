const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const git = require('isomorphic-git');
const get = require('simple-get');
const { PassThrough } = require('stream');
const { Octokit } = require('@octokit/rest');

const root = process.cwd();
const ignoreDirs = new Set(['node_modules', 'build', 'dist', 'coverage', '.git']);

function fromValue(value) {
  let queue = [value];
  return {
    next() {
      return Promise.resolve({ done: queue.length === 0, value: queue.pop() });
    },
    return() {
      queue = [];
      return {};
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

function getIterator(iterable) {
  if (iterable[Symbol.asyncIterator]) return iterable[Symbol.asyncIterator]();
  if (iterable[Symbol.iterator]) return iterable[Symbol.iterator]();
  if (iterable.next) return iterable;
  return fromValue(iterable);
}

async function forAwait(iterable, cb) {
  const iter = getIterator(iterable);
  while (true) {
    const { value, done } = await iter.next();
    if (value) await cb(value);
    if (done) break;
  }
  if (iter.return) iter.return();
}

function asyncIteratorToStream(iter) {
  const stream = new PassThrough();
  setTimeout(async () => {
    await forAwait(iter, chunk => stream.write(chunk));
    stream.end();
  }, 1);
  return stream;
}

async function collect(iterable) {
  let size = 0;
  const buffers = [];
  await forAwait(iterable, value => {
    buffers.push(value);
    size += value.byteLength;
  });
  const result = new Uint8Array(size);
  let nextIndex = 0;
  for (const buffer of buffers) {
    result.set(buffer, nextIndex);
    nextIndex += buffer.byteLength;
  }
  return result;
}

function fromNodeStream(stream) {
  let ended = false;
  const queue = [];
  let defer = {};
  stream.on('data', chunk => {
    queue.push(chunk);
    if (defer.resolve) {
      defer.resolve({ value: queue.shift(), done: false });
      defer = {};
    }
  });
  stream.on('error', err => {
    if (defer.reject) {
      defer.reject(err);
      defer = {};
    }
  });
  stream.on('end', () => {
    ended = true;
    if (defer.resolve) {
      defer.resolve({ done: true });
      defer = {};
    }
  });
  return {
    next() {
      return new Promise((resolve, reject) => {
        if (queue.length === 0 && ended) {
          return resolve({ done: true });
        } else if (queue.length > 0) {
          return resolve({ value: queue.shift(), done: false });
        } else if (queue.length === 0 && !ended) {
          defer = { resolve, reject };
        }
      });
    },
    return() {
      stream.removeAllListeners();
      if (stream.destroy) stream.destroy();
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

const http = {
  request: async ({ url, method = 'GET', headers = {}, agent, body }) => {
    if (body && Array.isArray(body)) {
      body = Buffer.from(await collect(body));
    } else if (body) {
      body = asyncIteratorToStream(body);
    }
    return new Promise((resolve, reject) => {
      get(
        {
          url,
          method,
          headers,
          agent,
          body,
          timeout: 120000,
        },
        (err, res) => {
          if (err) return reject(err);
          try {
            const iter = fromNodeStream(res);
            resolve({
              url: res.url,
              method: res.method,
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              body: iter,
              headers: res.headers,
            });
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  },
};

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
