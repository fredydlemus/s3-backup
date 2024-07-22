const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const fs = require("fs");
const path = require("path");

const {
  getAndValidateInputs,
  setupAwsCredentials,
  createBackupArchive,
  syncToS3,
  cleanup,
  run,
} = require("./main");

jest.mock("@actions/core");
jest.mock("@actions/github");
jest.mock("@actions/exec");
jest.mock("path");

describe("S3 Backup Action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAndValidateInputs", () => {
    it("should return valid inputs when all required inputs are provided", () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          "target-bucket": "my-bucket",
          "bucket-region": "us-west-2",
          "role-arn": "arn:aws:iam::123456789012:role/my-role",
          "oidc-audience": "sts.amazonaws.com",
          "backup-prefix": "my-prefix",
        };
        return inputs[name];
      });

      const result = getAndValidateInputs();
      expect(result).toEqual({
        targetBucket: "my-bucket",
        bucketRegion: "us-west-2",
        roleArn: "arn:aws:iam::123456789012:role/my-role",
        oidcAudience: "sts.amazonaws.com",
        backupPrefix: "my-prefix",
      });
    });

    it("should throw an error when required inputs are missing", () => {
      core.getInput.mockImplementation(() => "");
      expect(getAndValidateInputs).toThrow("Missing required inputs");
    });
  });

  describe("setupAwsCredentials", () => {
    it("should set up AWS credentials correctly", async () => {
      const mockInputs = {
        bucketRegion: "us-west-2",
        roleArn: "arn:aws:iam::123456789012:role/my-role",
        oidcAudience: "sts.amazonaws.com",
      };
      core.getIDToken.mockResolvedValue("id-token");
      exec.exec.mockImplementation((cmd, args, options) => {
        if (options && options.listeners && options.listeners.stdout) {
          options.listeners.stdout(
            JSON.stringify({
              Credentials: {
                AccessKeyId: "mock-access-key",
                SecretAccessKey: "mock-secret-key",
                SessionToken: "mock-session-token",
              },
            })
          );

          return Promise.resolve(0);
        }
      });

      await setupAwsCredentials(mockInputs);

      expect(core.exportVariable).toHaveBeenCalledWith(
        "AWS_REGION",
        "us-west-2"
      );
      expect(core.exportVariable).toHaveBeenCalledWith(
        "AWS_ACCESS_KEY_ID",
        "mock-access-key"
      );
      expect(core.exportVariable).toHaveBeenCalledWith(
        "AWS_SECRET_ACCESS_KEY",
        "mock-secret-key"
      );
      expect(core.exportVariable).toHaveBeenCalledWith(
        "AWS_SESSION_TOKEN",
        "mock-session-token"
      );
    });
  });

  describe("createBackupArchive", () => {
    it('should create a backup archive with correct name', async () =>{
        const mockDate = new Date('2023-01-01T00:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

        github.context = {repo: {repo: 'test-repo'}};
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        path.join.mockImplementation((...args) => args.join('/'));

        const result = await createBackupArchive('backup');

        expect(result).toBe('tmp/backup/backup_test-repo_20230101T000000000Z.tar.gz');
        expect(exec.exec).toHaveBeenCalledWith('tar', ['-czf', result, '.'], expect.any(Object));
    })
  });
});
