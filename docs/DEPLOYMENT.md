# GlobalInvoiceAI Deployment Guide

This guide provides step-by-step instructions for deploying the GlobalInvoiceAI Agent to your AWS environment.

## Prerequisites

### Required Tools
- **AWS CLI** (v2.x) - [Installation Guide](https://aws.amazon.com/cli/)
- **AWS SAM CLI** - [Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- **Git** - For cloning the repository
- **Node.js** (v16+) - For frontend build
- **Python** (v3.11+) - For Lambda functions
- **Docker** - For building container images

### AWS Account Setup
1. **Create AWS Account** (if you don't have one)
2. **Configure AWS CLI**:
   ```bash
   aws configure
   ```
   Enter your AWS Access Key ID, Secret Access Key, default region, and output format.

3. **Set up GitHub OIDC Provider** (Required for GitHub Actions):
   ```bash
   # Create OIDC provider for GitHub
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

   # Create IAM role for GitHub Actions
   # Replace YOUR_AWS_ACCOUNT_ID and YOUR_GITHUB_REPO with actual values
   aws iam create-role \
     --role-name personal-github-oidc-role \
     --assume-role-policy-document '{
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Principal": {
             "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
           },
           "Action": "sts:AssumeRoleWithWebIdentity",
           "Condition": {
             "StringEquals": {
               "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
             },
             "StringLike": {
               "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_GITHUB_REPO:*"
             }
           }
         }
       ]
     }'

   # Attach CloudFormation deployment permissions
   aws iam attach-role-policy \
     --role-name personal-github-oidc-role \
     --policy-arn arn:aws:iam::aws:policy/CloudWatchFullAccess

   aws iam attach-role-policy \
     --role-name personal-github-oidc-role \
     --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess

   # Note: Use least-privilege policies in production
   ```

4. **Configure GitHub Repository Secrets**:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add repository secret: `AWS_ACCOUNT_ID` with your AWS account ID

4. **Enable Required Services**:
   - Amazon Bedrock (request access if needed)
   - AWS Amplify
   - AWS Cognito

## Step 1: Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/GlobalInvoiceAI.git
cd GlobalInvoiceAI
```

## Step 2: Set Up GitHub Actions (Recommended)

### Repository Configuration

1. **Create GitHub Repository** (if not already done)
2. **Set Repository Secrets** in GitHub Settings > Secrets and variables > Actions:
   - `AWS_ACCOUNT_ID`: Your AWS account ID (used to construct the IAM role ARN for GitHub Actions OIDC authentication)

3. **Configure Branch Protection** (optional but recommended):
   - Require status checks before merging
   - Require up-to-date branches

### Automated Deployment

The GitHub Actions workflow will automatically:

- ✅ **Validate** CloudFormation templates
- ✅ **Deploy** infrastructure to AWS
- ✅ **Build** AgentCore Docker image
- ✅ **Test** all components
- ✅ **Clean up** temporary resources

**Deployment Triggers:**
- Push to `main` → Production deployment
- Push to `develop` → Development deployment
- Manual trigger via GitHub Actions UI

### Manual Deployment (Alternative)

If you prefer manual deployment:

## Step 3: Deploy Infrastructure

### Option A: Using AWS CLI (Recommended)

```bash
# 1. Package the CloudFormation template
aws cloudformation package \
  --template-file cloudformation/globalinvoiceai-stack.yaml \
  --s3-bucket your-deployment-bucket-name \
  --output-template-file packaged-template.yaml

# 2. Deploy the stack
aws cloudformation deploy \
  --template-file packaged-template.yaml \
  --stack-name globalinvoiceai-dev \
  --parameter-overrides \
    Environment=dev \
    CognitoDomainPrefix=YOUR_GENERATED_DOMAIN_PREFIX \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --region us-east-1
```

**Note:** Generate a unique `CognitoDomainPrefix` value. The GitHub Actions workflow automatically generates and validates unique domain prefixes.

### Option B: Using AWS Console
1. Go to AWS CloudFormation Console
2. Click "Create Stack" → "With new resources"
3. Upload `cloudformation/globalinvoiceai-stack.yaml`
4. Enter parameters:
   - Environment: `dev`
   - CognitoDomainPrefix: `YOUR_GENERATED_DOMAIN_PREFIX` (generate a unique value)
5. Deploy stack

## Step 4: Post-Deployment Configuration

### 1. Get Stack Outputs
After deployment completes, get the output values:

```bash
aws cloudformation describe-stacks \
  --stack-name globalinvoiceai-dev \
  --query 'Stacks[0].Outputs' \
  --output table
```

Save these values:
- `AmplifyAppUrl` - Admin dashboard URL
- `ApiGatewayUrl` - API endpoint for integrations
- `InvoiceUploadBucketName` - S3 bucket for invoice uploads
- `UserPoolId` - Cognito User Pool ID

### 2. Configure GitHub Integration (Optional)
If you want to enable continuous deployment:

1. Create a GitHub repository for the frontend code
2. Update the `AmplifyApp` resource in the CloudFormation template:
   ```yaml
   Repository: 'https://github.com/YOUR_USERNAME/GlobalInvoiceAI'
   AccessToken: 'YOUR_GITHUB_TOKEN'
   ```

3. Update the stack to enable auto-deployment

## Step 5: Create Admin User

### Using AWS CLI
```bash
# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@globalinvoiceai.com \
  --user-attributes \
    Name=email,Value=admin@globalinvoiceai.com \
    Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin@globalinvoiceai.com \
  --password YourSecurePassword123! \
  --permanent
```

### Using Cognito Console
1. Go to AWS Cognito Console
2. Select your User Pool
3. Go to "Users and groups"
4. Click "Create user"
5. Enter email and set temporary password

## Step 6: Test the Deployment

### 1. Access Admin Dashboard
1. Open the `AmplifyAppUrl` from stack outputs
2. Sign in with the admin credentials you created
3. Verify you can see the dashboard

### 2. Test Invoice Upload
1. Go to the "Invoices" page in the dashboard
2. Upload one of the sample invoice files:
   - `sample-data/invoice-us.json`
   - `sample-data/invoice-uk.json`
   - `sample-data/invoice-india.json`
3. Monitor the processing in real-time

### 3. Verify PDF Generation
1. After processing completes, click "Download PDF"
2. Verify the generated PDF contains correct formatting and calculations

## Step 7: Monitor Deployments

### GitHub Actions Monitoring
1. **Actions Tab**: Monitor deployment progress in real-time
2. **Deployment Artifacts**: Download deployment summary for details
3. **Environment Status**: Check deployment status in repository environments
4. **PR Comments**: Automatic status updates on pull requests

### CloudWatch Dashboard
Access the monitoring dashboard:
1. Go to CloudWatch Console
2. Navigate to Dashboards
3. Find `globalinvoiceai-dev-dashboard`
4. Monitor metrics and logs

### Scaling Considerations
- **Lambda Concurrency**: Default limits should handle most loads
- **DynamoDB**: On-demand billing scales automatically
- **Bedrock**: Request rate limits may apply for high volume

## Troubleshooting

### Common Issues

#### GitHub Actions Deployment Fails
**Error**: `AWS credentials not configured`
**Solution**:
1. Verify the OIDC provider is created in AWS IAM
2. Check that the IAM role has the correct trust policy for GitHub Actions
3. Ensure the repository variable `AWS_ROLE_ARN` is set correctly
4. Verify the IAM role has CloudFormation, ECR, and Lambda permissions

**Error**: `Access denied`
**Solution**:
1. Check the IAM role trust policy allows your GitHub repository
2. Ensure the role has the necessary permissions attached
3. Verify the OIDC thumbprint is current (may need updating)

**Error**: `ECR repository not found`
**Solution**: The CloudFormation stack must be deployed first before the AgentCore build step runs

#### CloudFormation Deployment Fails
**Error**: `Template format error`
**Solution**: Validate template syntax:
```bash
aws cloudformation validate-template \
  --template-body file://cloudformation/globalinvoiceai-stack.yaml
```

**Error**: `Resource creation failed`
**Solution**: Check CloudWatch logs for specific error details

#### AgentCore Runtime Issues
**Error**: `AgentCore Runtime not available`
**Solution**:
1. Verify ECR repository was created
2. Check if AgentCoreDeployFunction completed successfully
3. Verify IAM permissions for AgentCore execution role

#### Authentication Issues
**Error**: `User pool not found`
**Solution**:
1. Verify Cognito User Pool was created successfully
2. Check stack outputs for correct User Pool ID
3. Ensure domain prefix is unique

**Error**: `Domain already exists`
**Solution**: The Cognito domain prefix must be unique across all AWS accounts. Generate a new unique prefix using:
```bash
# Generate unique domain prefix
RANDOM_SUFFIX=$(echo $RANDOM | md5sum | head -c 6)
DOMAIN_PREFIX="globalinvoiceai-dev-${RANDOM_SUFFIX}"
echo "Use domain prefix: ${DOMAIN_PREFIX}"
```

# API Gateway Issues removed - no longer using external APIs

### Debug Mode
Enable detailed logging by updating Lambda environment variables:
```yaml
LOG_LEVEL: DEBUG
```

### Support Resources
- **AWS Documentation**: [Bedrock AgentCore](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
- **Strands Framework**: [Documentation](https://strands.readthedocs.io/)
- **CloudFormation**: [User Guide](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/)

## Cleanup

To remove all resources:

```bash
aws cloudformation delete-stack \
  --stack-name globalinvoiceai-dev

# Delete S3 bucket contents (if needed)
aws s3 rm s3://your-deployment-bucket-name --recursive
```

## Security Best Practices

1. **OIDC Authentication**: Use GitHub OIDC provider instead of long-lived credentials
2. **IAM Roles**: Use least-privilege permissions with role-based access
3. **Network**: Consider VPC endpoints for production deployments
4. **Encryption**: All data encrypted at rest and in transit
5. **Monitoring**: Enable CloudTrail for audit logging and compliance
6. **Branch Protection**: Require reviews and status checks before merging

*Note: External API keys are no longer used in this version. In production, you would implement proper API key management for real-time services.*

## Cost Optimization

**Development Environment**:
- Lambda: ~$0.50/month (pay-per-invocation)
- Bedrock: ~$2.00/month (pay-per-token)
- DynamoDB: ~$1.00/month (on-demand)
- Total: ~$3.60/month

**Production Scaling**:
- Monitor usage patterns
- Set up billing alerts
- Use cost allocation tags

---

For additional support, create an issue in the GitHub repository or contact the development team.
