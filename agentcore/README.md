# GlobalInvoiceAI AgentCore Application

This folder contains the AgentCore application that powers the GlobalInvoiceAI invoice processing system using Amazon Bedrock AgentCore and the Strands framework.

## 📁 File Structure

```
agentcore/
├── invoice_agent.py      # Main Strands agent application
├── Dockerfile           # Docker container definition
├── requirements.txt     # Python dependencies
├── build.sh            # Build and deployment script
└── README.md           # This file
```

## 🏗️ Architecture

The AgentCore application uses:

- **Strands Framework**: For defining AI agents with tools and workflows
- **Amazon Bedrock AgentCore**: Runtime environment for autonomous agents
- **Claude 3.5 Sonnet**: Large language model for intelligent processing
- **AWS Services**: DynamoDB, CloudWatch for data and monitoring

## 🛠️ Tools Available

The agent includes the following tools:

1. **`get_tax_rate(country, region, tax_type)`**: Look up tax rates from hardcoded values
2. **`convert_currency(amount, from_currency, to_currency)`**: Currency conversion using hardcoded rates
3. **`validate_invoice_fields(invoice_data)`**: Validate required invoice fields
4. **`detect_discrepancies(invoice, expected_values)`**: Detect pricing/quantity issues
5. **`store_invoice_result(invoice_id, validation_result)`**: Store results in DynamoDB

## 🚀 Deployment

### Prerequisites

1. **AWS Account** with Bedrock AgentCore access
2. **Docker** installed and configured
3. **AWS CLI** configured with appropriate permissions
4. **CloudFormation Stack** deployed (creates ECR repository)

### Build and Deploy

1. **Build the Docker image**:
   ```bash
   # Using the build script
   ./build.sh

   # Or manually:
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ECR_URI
   docker build -t YOUR_ECR_URI:latest .
   docker push YOUR_ECR_URI:latest
   ```

2. **Deploy via CloudFormation**: The CloudFormation template automatically:
   - Builds and pushes the Docker image
   - Creates the AgentCore Agent and Runtime
   - Configures the runtime with the container image
   - Stores the runtime ARN in Parameter Store

### Environment Variables

The application uses these environment variables:

- `TAX_RATES_TABLE`: DynamoDB table for tax rate caching
- `INVOICES_TABLE`: DynamoDB table for invoice storage
- `AWS_REGION`: AWS region for service clients

*Note: External API keys are no longer needed as hardcoded values are used for demo purposes.*

## 🔧 Development

### Local Testing

For local development and testing:

```bash
# Install dependencies
pip install -r requirements.txt

# Run the agent locally (for testing)
python invoice_agent.py
```

### Debugging

Enable debug logging by setting:
```bash
export LOG_LEVEL=DEBUG
```

Common debugging approaches:
- Check CloudWatch logs for the AgentCore Runtime
- Verify ECR image was built and pushed correctly
- Ensure IAM permissions are correct for all services
- Check Parameter Store for runtime ARN

## 🔒 Security

- **Least Privilege IAM**: Roles have minimal required permissions
- **Encrypted Communication**: All AWS service calls use encryption
- **Audit Logging**: All operations logged for compliance

*Note: External API keys are no longer used in this version. In production, implement proper secrets management for real-time API integration.*

## 📊 Monitoring

- **CloudWatch Logs**: AgentCore runtime logs and errors
- **CloudWatch Metrics**: Processing times, error rates, invocation counts
- **X-Ray Tracing**: Distributed tracing for performance analysis

## 🚨 Troubleshooting

### Common Issues

**AgentCore Runtime not found**:
- Verify CloudFormation stack deployed successfully
- Check ECR repository exists and image is pushed
- Ensure AgentCoreDeployFunction completed

**Permission errors**:
- Verify IAM roles have correct permissions
- Check VPC configuration if using private subnets
- Ensure Bedrock service access is enabled

**Tool execution errors**:
- Check DynamoDB table permissions
- Verify table names are correctly configured

### Support

For issues:
1. Check CloudWatch logs for error details
2. Verify CloudFormation stack outputs
3. Test individual components in isolation
4. Review AWS service quotas and limits

---

**Note**: This AgentCore application is designed to work with the GlobalInvoiceAI CloudFormation stack and should be deployed as part of the complete solution.
