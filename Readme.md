# Backup to AWS S3 GitHub Action

This GitHub Action allows you to easily backup your repository to an AWS S3 bucket using OpenID Connect (OIDC) for secure authentication. It creates a compressed archive of your repository and uploads it to the specified S3 bucket.

## Features

- Secure authentication using OIDC
- Customizable backup prefix
- Automatic timestamp-based naming for backups
- Cleanup of temporary files after backup

## Usage

To use this action in your workflow, add the following step:

```yaml
- name: Backup to S3
  uses: fredydlemus/s3-backup@v1
  with:
    target-bucket: 'your-s3-bucket-name'
    bucket-region: 'your-s3-bucket-region'
    role-arn: 'arn:aws:iam::your-account-id:role/your-role-name'
    oidc-audience: 'sts.amazonaws.com'
    backup-prefix: 'backup'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `target-bucket` | The name of the S3 bucket where the backup will be stored | Yes | N/A |
| `bucket-region` | The AWS region where the S3 bucket is located | Yes | N/A |
| `role-arn` | The ARN of the IAM role to assume for S3 access | Yes | N/A |
| `oidc-audience` | The audience value for the OIDC token | No | `sts.amazonaws.com` |
| `backup-prefix` | Prefix for the backup file name | No | `backup` |

## Prerequisites

1. An AWS S3 bucket to store the backups
2. An IAM role with permissions to write to the S3 bucket
3. GitHub OIDC provider configured in your AWS account

## Setup

### 1. Create an IAM Role

Create an IAM role in your AWS account with the necessary permissions to write to your S3 bucket. Ensure the role's trust relationship allows GitHub's OIDC provider.

### 2. Configure GitHub OIDC

Follow GitHub's documentation to [configure the OpenID Connect in AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services).

### 3. Add the Action to Your Workflow

Add the action to your GitHub workflow YAML file as shown in the Usage section above.

## How It Works

1. The action validates the input parameters.
2. It sets up AWS credentials using the OIDC token and assumes the specified IAM role.
3. A compressed archive of the repository is created with a timestamp-based name.
4. The archive is uploaded to the specified S3 bucket.
5. Temporary files are cleaned up after the backup process.

## Error Handling

If any step of the process fails, the action will report the error and fail the GitHub workflow.

## Contributing

Contributions to this action are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any problems or have any questions, please open an issue in this repository.

---

Made with ❤️ by [fredydlemus](https://github.com/fredydlemus)
