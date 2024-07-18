const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');

async function run() {
    try{
        const bucket = core.getInput('target-bucket', { required: true });
        const bucketRegion = core.getInput('bucket-region', { required: true });
        const roleArn = core.getInput('role-arn', { required: true });
        const oidcAudience = core.getInput('oidc-audience', { required: true });

        core.exportVariable('AWS_REGION', bucketRegion);
        const idToken = await core.getIDToken(oidcAudience);

        let assumeRoleOutput = '';
        await exec.exec(`aws sts assume-role-with-web-identity --role-arn ${roleArn} --role-session-name deploy-s3-javascript-action --web-identity-token ${idToken} --duration-seconds 3600`, [], {
            listeners: {
                stdout: (data) => {
                    assumeRoleOutput += data.toString();
                }
            }
        });

        const creds = JSON.parse(assumeRoleOutput);
        const accessKeyId = creds.Credentials.AccessKeyId;
        const secretAccessKey = creds.Credentials.SecretAccessKey;
        const sessionToken = creds.Credentials.SessionToken;

        core.exportVariable('AWS_ACCESS_KEY_ID', accessKeyId);
        core.exportVariable('AWS_SECRET_ACCESS_KEY', secretAccessKey);
        core.exportVariable('AWS_SESSION_TOKEN', sessionToken);

        const s3Uri = `s3://${bucket}/`;

        const repoName = github.context.repo.repo;
        
        const backupDir = '/tmp/backup';
        if(!fs.existsSync(backupDir)){
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[-:.]/g, '');

        const archivePath = path.join(backupDir, `${repoName}_${timestamp}.tar.gz`);
        await exec.exec(`tar -czf ${archivePath} *`, [], { cwd: process.env.GITHUB_WORKSPACE });

        await exec.exec(`mv ${archivePath} ${process.env.GITHUB_WORKSPACE}/`);

        await exec.exec('ls -la', [], { cwd: process.env.GITHUB_WORKSPACE });

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();