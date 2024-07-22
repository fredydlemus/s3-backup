const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = "tmp/backup";
const ARCHIVE_EXTENSION = ".tar.gz";

/**
 * Main function to run the action
 */
async function run() {
  try {
    const inputs = getAndValidateInputs();
    await setupAwsCredentials(inputs);
    const archivePath = await createBackupArchive(inputs.backupPrefix);
    await syncToS3(inputs.targetBucket, archivePath);
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  } finally {
    await cleanup();
  }
}

/**
 * Get and validate the inputs
 * @returns {Object} Validated inputs
 */
function getAndValidateInputs() {
  const targetBucket = core.getInput("target-bucket", { required: true });
  const bucketRegion = core.getInput("bucket-region", { required: true });
  const roleArn = core.getInput("role-arn", { required: true });
  const oidcAudience = core.getInput("oidc-audience", { required: true });
  const backupPrefix = core.getInput("backup-prefix") || "backup";

  if (!targetBucket || !bucketRegion || !roleArn) {
    throw new Error("Missing required inputs");
  }

  return { targetBucket, bucketRegion, roleArn, oidcAudience, backupPrefix };
}

/**
 * Setup AWS credentials using OIDC
 * @param {Object} inputs Action Inputs
 */
async function setupAwsCredentials(inputs) {
  core.exportVariable("AWS_REGION", inputs.bucketRegion);

  const idToken = await core.getIDToken(inputs.oidcAudience);
  core.setSecret(idToken);

  let assumeRoleOutput = "";
  await exec.exec(
    "aws",
    [
      "sts",
      "assume-role-with-web-identity",
      "--role-arn",
      inputs.roleArn,
      "--role-session-name",
      "deploy-s3-javascript-action",
      "--web-identity-token",
      idToken,
      "--duration-seconds",
      "3600",
    ],
    {
      listeners: {
        stdout: (data) => {
          assumeRoleOutput += data.toString();
        },
      },
      silent: true,
    }
  );

  const creds = JSON.parse(assumeRoleOutput);
  core.setSecret(creds.Credentials.AccessKeyId);
  core.setSecret(creds.Credentials.SecretAccessKey);
  core.setSecret(creds.Credentials.SessionToken);

  core.exportVariable("AWS_ACCESS_KEY_ID", creds.Credentials.AccessKeyId);
  core.exportVariable(
    "AWS_SECRET_ACCESS_KEY",
    creds.Credentials.SecretAccessKey
  );
  core.exportVariable("AWS_SESSION_TOKEN", creds.Credentials.SessionToken);
}

/**
 * Create a backup archive of the repository
 * @param {string} prefix Prefix for the archive file name
 * @returns {string} Archive file path
 */
async function createBackupArchive(prefix) {
  const repoName = github.context.repo.repo;

  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
  const archiveName = `${prefix}_${repoName}_${timestamp}${ARCHIVE_EXTENSION}`;
  const archivePath = path.join(TEMP_DIR, archiveName);

  core.info("Creating backup archive");

  await exec.exec("tar", ["-czf", archivePath, "."], {
    cwd: process.env.GITHUB_WORKSPACE,
  });

  return archivePath;
}

/**
 * Sync the backup archive to S3
 * @param {string} bucket S3 bucket name
 * @param {string} archivePath Path to the archive file
 */
async function syncToS3(bucket, archivePath) {
  const s3Uri = `s3://${bucket}/`;

  core.info(`Syncing backup to S3 bucket ${s3Uri}`);
  await exec.exec("aws", ["s3", "cp", archivePath, s3Uri]);
}

/**
 * Cleanup temporary files
 */
async function cleanup() {
  core.info("Cleaning up temporary files...");
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

module.exports = {
  run,
  getAndValidateInputs,
  setupAwsCredentials,
  createBackupArchive,
  syncToS3,
  cleanup,
};

if (require.main === module) {
  run();
}
