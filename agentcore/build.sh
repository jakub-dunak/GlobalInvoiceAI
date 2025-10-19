#!/bin/bash

# GlobalInvoiceAI AgentCore Build Script
# This script builds and pushes the Docker image for the AgentCore application

set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REPO_NAME=${ECR_REPO_NAME:-globalinvoiceai-agent-dev}
IMAGE_TAG=${IMAGE_TAG:-latest}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Building GlobalInvoiceAI AgentCore Application${NC}"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Get ECR repository URI
echo -e "${YELLOW}📦 Getting ECR repository information...${NC}"
ECR_URI=$(aws ecr describe-repositories --repository-names ${ECR_REPO_NAME} --region ${AWS_REGION} --query 'repositories[0].repositoryUri' --output text)

if [ "${ECR_URI}" = "None" ]; then
    echo -e "${RED}❌ ECR repository '${ECR_REPO_NAME}' not found in region '${AWS_REGION}'.${NC}"
    echo -e "${YELLOW}💡 Make sure the CloudFormation stack is deployed first.${NC}"
    exit 1
fi

FULL_IMAGE_TAG="${ECR_URI}:${IMAGE_TAG}"

echo -e "${GREEN}✅ ECR Repository: ${ECR_URI}${NC}"

# Login to ECR
echo -e "${YELLOW}🔐 Logging into ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# Build Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker build -t ${FULL_IMAGE_TAG} .

# Push Docker image
echo -e "${YELLOW}📤 Pushing Docker image to ECR...${NC}"
docker push ${FULL_IMAGE_TAG}

echo -e "${GREEN}✅ Successfully built and pushed image: ${FULL_IMAGE_TAG}${NC}"

# Optional: Update AgentCore Runtime if needed
if [ "${UPDATE_RUNTIME}" = "true" ]; then
    echo -e "${YELLOW}🔄 Updating AgentCore Runtime...${NC}"
    # This would require the AgentCore Runtime ARN and proper AWS permissions
    echo -e "${YELLOW}💡 Note: Runtime updates should be handled by the CloudFormation deployment.${NC}"
fi

echo -e "${GREEN}🎉 Build complete! The AgentCore application is ready.${NC}"
