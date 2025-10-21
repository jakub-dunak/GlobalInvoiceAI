#!/usr/bin/env node

/**
 * Configures the frontend aws-exports.js with CloudFormation outputs
 * Usage: node scripts/configure-frontend.js <user-pool-id> <user-pool-client-id> [region] [environment]
 */

const fs = require('fs');
const path = require('path');

const [,, userPoolId, userPoolClientId, region, environment = 'production'] = process.argv;

if (!userPoolId || !userPoolClientId || !region) {
  console.error('Usage: node scripts/configure-frontend.js <user-pool-id> <user-pool-client-id> <region> [environment]');
  process.exit(1);
}

const config = {
  "aws_project_region": region,
  "aws_cognito_region": region,
  "aws_user_pools_id": userPoolId,
  "aws_user_pools_web_client_id": userPoolClientId,
  "oauth": {},
  "aws_cognito_username_attributes": [
    "EMAIL"
  ],
  "aws_cognito_social_providers": [],
  "aws_cognito_signup_attributes": [
    "EMAIL",
    "NAME"
  ],
  "aws_cognito_mfa_configuration": "OFF",
  "aws_cognito_mfa_types": [],
  "aws_cognito_password_protection_settings": {
    "passwordPolicyMinLength": 8,
    "passwordPolicyCharacters": [
      "REQUIRES_LOWERCASE",
      "REQUIRES_UPPERCASE",
      "REQUIRES_NUMBERS",
      "REQUIRES_SYMBOLS"
    ]
  },
  "aws_cognito_verification_mechanisms": [
    "EMAIL"
  ],
  "aws_appsync_graphqlEndpoint": "",
  "aws_appsync_region": region,
  "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS"
};

const configContent = `const awsmobile = ${JSON.stringify(config, null, 2)};

export default awsmobile;
`;

const configPath = path.join(__dirname, '..', 'frontend', 'src', 'aws-exports.js');
fs.writeFileSync(configPath, configContent);

console.log('✅ Frontend configuration updated successfully!');
console.log(`   User Pool ID: ${userPoolId}`);
console.log(`   Client ID: ${userPoolClientId}`);
console.log(`   Region: ${region}`);
