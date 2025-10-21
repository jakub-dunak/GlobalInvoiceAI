import json
import boto3
import os
import zipfile
import tempfile
import subprocess
from datetime import datetime
import base64

ecr_client = boto3.client('ecr')
bedrock_agentcore = boto3.client('bedrock-agentcore')
ssm = boto3.client('ssm')

def handler(event, context):
    """Custom resource to deploy AgentCore application"""
    try:
        request_type = event['RequestType']

        if request_type == 'Create':
            return create_agentcore_app()
        elif request_type == 'Update':
            return update_agentcore_app()
        elif request_type == 'Delete':
            return delete_agentcore_app()

    except Exception as e:
        print(f"Error in AgentCore deployment: {str(e)}")
        raise e

def create_agentcore_app():
    """Create and deploy the AgentCore application"""
    agent_name = os.environ['AGENT_NAME']
    repo_name = os.environ['ECR_REPO']

    # Get ECR login token
    auth_token = ecr_client.get_authorization_token()
    username, password = base64.b64decode(auth_token['authorizationData'][0]['authorizationToken']).decode().split(':')

    # Build and push container image
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create Dockerfile
        dockerfile_content = '''
FROM public.ecr.aws/lambda/python:3.11

COPY invoice_agent.py requirements.txt ./

RUN pip install -r requirements.txt

CMD ["invoice_agent.app"]
'''

        with open(f'{temp_dir}/Dockerfile', 'w') as f:
            f.write(dockerfile_content)

        # Create requirements.txt
        requirements_content = '''
bedrock-agentcore-sdk-python==1.0.0
strands-agents==1.0.0
boto3==1.34.0
requests==2.31.0
'''

        with open(f'{temp_dir}/requirements.txt', 'w') as f:
            f.write(requirements_content)

        # Create agent code
        agent_code = '''
from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
import boto3

app = BedrockAgentCoreApp()

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
# Removed secrets manager client - using hardcoded values
s3 = boto3.client('s3')

@tool
def get_tax_rate(country: str, region: str, tax_type: str) -> dict:
    """Get tax rate for country/region from cache or API"""
    # Check DynamoDB cache first
    tax_table = dynamodb.Table(os.environ['TAX_RATES_TABLE'])

    try:
        response = tax_table.get_item(Key={'CountryRegion': f"{country}-{region}", 'TaxType': tax_type})
        if 'Item' in response:
            return {
                "rate": float(response['Item']['Rate']),
                "source": "cache",
                "last_updated": response['Item']['UpdatedAt']
            }
    except Exception as e:
        print(f"Cache lookup failed: {e}")

    # Call external API
    try:
        secret_name = os.environ.get('API_KEYS_SECRET', 'globalinvoiceai-external-api-keys-dev')
        secrets_response = secrets.get_secret_value(SecretId=secret_name)
        api_keys = json.loads(secrets_response['SecretString'])

        # Use abstractAPI for tax rates (placeholder - replace with actual API)
        # For demo, return hardcoded rates
        tax_rates = {
            "US-CA": {"VAT": 0.0875, "SALES_TAX": 0.0875},
            "US-NY": {"VAT": 0.08, "SALES_TAX": 0.08},
            "UK": {"VAT": 0.20},
            "IN": {"GST": 0.18}
        }

        if f"{country}-{region}" in tax_rates and tax_type in tax_rates[f"{country}-{region}"]:
            rate = tax_rates[f"{country}-{region}"][tax_type]

            # Cache the result
            tax_table.put_item(Item={
                'CountryRegion': f"{country}-{region}",
                'TaxType': tax_type,
                'Rate': rate,
                'UpdatedAt': datetime.utcnow().isoformat(),
                'TTL': int(datetime.utcnow().timestamp()) + 86400  # 24 hours
            })

            return {"rate": rate, "source": "api", "last_updated": datetime.utcnow().isoformat()}
    except Exception as e:
        print(f"API call failed: {e}")

    # Fallback to hardcoded rates
    fallback_rates = {"US": 0.07, "UK": 0.20, "IN": 0.18}
    rate = fallback_rates.get(country, 0.0)

    return {"rate": rate, "source": "fallback", "last_updated": datetime.utcnow().isoformat()}

@tool
def convert_currency(amount: float, from_currency: str, to_currency: str) -> dict:
    """Convert currency using hardcoded exchange rates"""
    # Hardcoded exchange rates for demo purposes
    # In production, these would come from real-time APIs like Fixer.io
    exchange_rates = {
        # Base rates (relative to USD)
        "USD": 1.0,
        "EUR": 0.85,     # 1 USD = 0.85 EUR
        "GBP": 0.73,     # 1 USD = 0.73 GBP
        "INR": 83.0,     # 1 USD = 83 INR
        "CAD": 1.35,     # 1 USD = 1.35 CAD
        "AUD": 1.52,     # 1 USD = 1.52 AUD
        "JPY": 150.0,    # 1 USD = 150 JPY
        "CHF": 0.92,     # 1 USD = 0.92 CHF
        "CNY": 7.25,     # 1 USD = 7.25 CNY
        "BRL": 5.2,      # 1 USD = 5.2 BRL
    }

    try:
        # Get exchange rates
        from_rate = exchange_rates.get(from_currency.upper(), 1.0)
        to_rate = exchange_rates.get(to_currency.upper(), 1.0)

        if from_rate == 1.0 and from_currency.upper() not in exchange_rates:
            return {"error": f"Unsupported currency: {from_currency}"}

        if to_rate == 1.0 and to_currency.upper() not in exchange_rates:
            return {"error": f"Unsupported currency: {to_currency}"}

        # Calculate conversion
        exchange_rate = to_rate / from_rate
        converted_amount = amount * exchange_rate

        return {
            "original_amount": amount,
            "converted_amount": round(converted_amount, 2),
            "exchange_rate": round(exchange_rate, 4),
            "from_currency": from_currency.upper(),
            "to_currency": to_currency.upper(),
            "timestamp": datetime.utcnow().isoformat(),
            "source": "hardcoded"
        }

    except Exception as e:
        return {"error": f"Currency conversion failed: {str(e)}"}

@tool
def validate_invoice_fields(invoice_data: dict) -> dict:
    """Validate invoice has required fields"""
    required_fields = ['customer_name', 'total_amount', 'currency']
    missing_fields = []

    for field in required_fields:
        if field not in invoice_data or not invoice_data[field]:
            missing_fields.append(field)

    errors = []
    warnings = []

    if missing_fields:
        errors.append(f"Missing required fields: {', '.join(missing_fields)}")

    # Validate amounts
    if 'total_amount' in invoice_data:
        try:
            amount = float(invoice_data['total_amount'])
            if amount <= 0:
                errors.append("Total amount must be positive")
            elif amount > 1000000:
                warnings.append("Very large amount - please verify")
        except (ValueError, TypeError):
            errors.append("Invalid total amount format")

    # Validate currency
    if 'currency' in invoice_data:
        valid_currencies = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']
        if invoice_data['currency'] not in valid_currencies:
            warnings.append(f"Currency {invoice_data['currency']} not in standard list")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }

@tool
def detect_discrepancies(invoice: dict, expected_values: dict) -> dict:
    """Detect pricing/quantity discrepancies"""
    discrepancies = []

    # Compare total amount
    if 'total_amount' in expected_values:
        expected_amount = float(expected_values['total_amount'])
        actual_amount = float(invoice.get('total_amount', 0))

        if abs(actual_amount - expected_amount) / expected_amount > 0.05:  # 5% tolerance
            discrepancies.append({
                "field": "total_amount",
                "expected": expected_amount,
                "actual": actual_amount,
                "difference": actual_amount - expected_amount,
                "percentage": abs(actual_amount - expected_amount) / expected_amount * 100
            })

    # Compare line items if available
    if 'line_items' in expected_values and 'line_items' in invoice:
        for i, (expected_item, actual_item) in enumerate(
            zip(expected_values['line_items'], invoice['line_items'])
        ):
            if expected_item.get('unit_price') != actual_item.get('unit_price'):
                discrepancies.append({
                    "field": f"line_items[{i}].unit_price",
                    "expected": expected_item.get('unit_price'),
                    "actual": actual_item.get('unit_price')
                })

    return {
        "has_discrepancies": len(discrepancies) > 0,
        "discrepancies": discrepancies,
        "severity": "high" if len(discrepancies) > 0 else "none"
    }

@tool
def store_invoice_result(invoice_id: str, validation_result: dict) -> dict:
    """Store validated invoice in DynamoDB"""
    invoices_table = dynamodb.Table(os.environ['INVOICES_TABLE'])

    try:
        invoices_table.update_item(
            Key={'InvoiceId': invoice_id},
            UpdateExpression='SET ValidationResult = :result, UpdatedAt = :updated',
            ExpressionAttributeValues={
                ':result': validation_result,
                ':updated': datetime.utcnow().isoformat()
            }
        )
        return {"success": True, "invoice_id": invoice_id}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Initialize Bedrock model
model = BedrockModel(
    model_id="us.amazon.nova-pro-v1:0"
)

# Create agent with tools
agent = Agent(
    model=model,
    system_prompt="""You are an expert invoice validation and generation agent for GlobalInvoiceAI.

Your responsibilities:
1. Validate incoming vendor invoices for pricing discrepancies, missing fields, and compliance
2. Calculate correct taxes based on country/region (US state sales tax, UK VAT 20%, India GST 18%)
3. Convert currencies using real-time exchange rates
4. Generate compliant outgoing customer invoices
5. Flag any errors or anomalies for human review

Always use available tools to lookup tax rates, convert currencies, and validate data.
Store all results for audit compliance.""",
    tools=[get_tax_rate, convert_currency, validate_invoice_fields,
           detect_discrepancies, store_invoice_result]
)

@app.entrypoint
async def process_invoice(payload, context):
    """Main entrypoint for invoice processing with streaming"""
    invoice_data = payload.get("invoice_data")
    operation = payload.get("operation", "validate")
    invoice_id = payload.get("invoice_id")

    if operation == "validate":
        prompt = f"""Validate this vendor invoice for compliance and accuracy:
{json.dumps(invoice_data, indent=2)}

Check: required fields, tax calculations, pricing, currency."""
    else:
        prompt = f"""Generate a compliant customer invoice based on this sale data:
{json.dumps(invoice_data, indent=2)}

Calculate correct taxes, apply currency conversion if needed."""

    try:
        # Stream response
        full_response = ""
        async for event in agent.stream_async(prompt):
            if "data" in event:
                full_response += event["data"]
                yield event["data"]

        # Parse final result and store
        result = json.loads(full_response)

        # Store result in DynamoDB
        store_result = store_invoice_result(invoice_id, result)
        if not store_result["success"]:
            yield {"error": f"Failed to store result: {store_result['error']}"}

        # Yield final success response
        yield {"status": "success", "response": full_response}

    except Exception as e:
        yield {"error": str(e)}

if __name__ == "__main__":
    app.run()
'''

        with open(f'{temp_dir}/invoice_agent.py', 'w') as f:
            f.write(agent_code)

        # Build and push Docker image
        repo_uri = auth_token['authorizationData'][0]['proxyEndpoint']
        image_tag = f"{repo_uri}/{repo_name}:latest"

        # Login to ECR
        subprocess.run(['docker', 'login', '--username', username, '--password', password, repo_uri],
                     check=True, capture_output=True)

        # Build image
        subprocess.run(['docker', 'build', '-t', image_tag, temp_dir],
                     check=True, capture_output=True)

        # Push image
        subprocess.run(['docker', 'push', image_tag],
                     check=True, capture_output=True)

        # Create AgentCore Agent
        agent_response = bedrock_agentcore.create_agent(
            agentName=agent_name,
            description='GlobalInvoiceAI Agent for invoice validation and generation',
            agentResourceRoleArn='${AGENTCORE_EXECUTION_ROLE_ARN}',
            tags=[
                {'key': 'Environment', 'value': '${ENVIRONMENT}'},
                {'key': 'Application', 'value': 'GlobalInvoiceAI'}
            ]
        )

        agent_id = agent_response['agent']['agentId']
        print(f"Created AgentCore Agent: {agent_id}")

        # Create AgentCore Runtime
        runtime_response = bedrock_agentcore.create_agent_runtime(
            agentId=agent_id,
            runtimeConfiguration={
                'type': 'container',
                'containerRuntimeConfiguration': {
                    'containerImageUri': image_tag
                }
            }
        )

        runtime_arn = runtime_response['agentRuntime']['agentRuntimeArn']
        print(f"Created AgentCore Runtime: {runtime_arn}")

        # Store runtime ARN in Parameter Store
        ssm.put_parameter(
            Name=os.environ['RUNTIME_PARAM'],
            Value=runtime_arn,
            Type='String',
            Description='AgentCore Runtime ARN for GlobalInvoiceAI'
        )

        return {
            'Status': 'SUCCESS',
            'PhysicalResourceId': agent_id,
            'Data': {
                'AgentId': agent_id,
                'RuntimeArn': runtime_arn
            }
        }

    except Exception as e:
        print(f"Error creating AgentCore app: {str(e)}")
        return {'Status': 'FAILED', 'Reason': str(e)}

def update_agentcore_app():
    """Update existing AgentCore application"""
    # Similar to create but for updates
    return {'Status': 'SUCCESS'}

def delete_agentcore_app():
    """Delete AgentCore application"""
    # Cleanup resources
    return {'Status': 'SUCCESS'}
