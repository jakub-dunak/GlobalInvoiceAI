from strands import Agent, tool
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
import boto3
from datetime import datetime
import os

app = BedrockAgentCoreApp()

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

@tool
def get_tax_rate(country: str, region: str, tax_type: str) -> dict:
    """Get tax rate for country/region using hardcoded values"""
    # Hardcoded tax rates for demo purposes
    # In production, these would come from external APIs or databases
    tax_rates = {
        # US States
        "US-CA": {"SALES_TAX": 0.0875, "VAT": 0.0875},
        "US-NY": {"SALES_TAX": 0.08, "VAT": 0.08},
        "US-TX": {"SALES_TAX": 0.0825, "VAT": 0.0825},
        "US-FL": {"SALES_TAX": 0.07, "VAT": 0.07},

        # UK
        "UK": {"VAT": 0.20},

        # India
        "IN": {"GST": 0.18},
        "IN-MH": {"GST": 0.18},  # Maharashtra
        "IN-KA": {"GST": 0.18},  # Karnataka
        "IN-DL": {"GST": 0.18},  # Delhi

        # Canada
        "CA-ON": {"HST": 0.13, "GST": 0.05, "PST": 0.08},
        "CA-BC": {"GST": 0.05, "PST": 0.07},
        "CA-QC": {"GST": 0.05, "QST": 0.09975},

        # Australia
        "AU-NSW": {"GST": 0.10},
        "AU-VIC": {"GST": 0.10},
        "AU-QLD": {"GST": 0.10},

        # European Union
        "DE": {"VAT": 0.19},  # Germany
        "FR": {"VAT": 0.20},  # France
        "IT": {"VAT": 0.22},  # Italy
        "ES": {"VAT": 0.21},  # Spain
        "NL": {"VAT": 0.21},  # Netherlands
    }

    # Get the rate
    country_region = f"{country}-{region}" if region else country
    if country_region in tax_rates and tax_type in tax_rates[country_region]:
        rate = tax_rates[country_region][tax_type]
        return {
            "rate": rate,
            "source": "hardcoded",
            "last_updated": datetime.utcnow().isoformat(),
            "tax_type": tax_type,
            "country": country,
            "region": region
        }

    # Fallback rates by country
    fallback_rates = {
        "US": 0.07,  # Average US sales tax
        "UK": 0.20,  # Standard VAT rate
        "IN": 0.18,  # GST
        "CA": 0.13,  # Average HST
        "AU": 0.10,  # GST
        "DE": 0.19,  # VAT
        "FR": 0.20,  # VAT
        "IT": 0.22,  # VAT
        "ES": 0.21,  # VAT
        "NL": 0.21,  # VAT
    }

    rate = fallback_rates.get(country, 0.0)
    return {
        "rate": rate,
        "source": "fallback",
        "last_updated": datetime.utcnow().isoformat(),
        "tax_type": tax_type,
        "country": country,
        "region": region
    }

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
    invoices_table = dynamodb.Table(os.environ.get('INVOICES_TABLE', 'globalinvoiceai-Invoices-dev'))

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
