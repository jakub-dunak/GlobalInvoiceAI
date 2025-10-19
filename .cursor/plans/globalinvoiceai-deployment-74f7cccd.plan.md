<!-- 74f7cccd-24e0-4383-8cc2-8458d5c0ab01 bfaf416d-96bb-4da6-bc63-8d7115838b9c -->
# GlobalInvoiceAI Agent - Complete AWS Serverless Solution

## Architecture Overview

Serverless AI invoice management system with:

- **S3 upload triggers** → Lambda invokes AgentCore Runtime
- **Bedrock AgentCore + Strands Framework** for autonomous agent with inline tools
- **DynamoDB** for invoice records, tax cache, processing logs
- **Amplify + Cognito** for secure admin UI
- **CloudWatch** for monitoring/alarms
- Focus on US, UK, India tax systems for demo

## Implementation Steps

### 1. Core Infrastructure (CloudFormation)

**File:** `cloudformation/globalinvoiceai-stack.yaml`

Create comprehensive CloudFormation template containing:

- **S3 Buckets:**
  - `InvoiceUploadBucket` - for incoming invoice JSON/CSV files (with event notification to Lambda)
  - `ProcessedInvoicesBucket` - for validated invoices and generated PDFs
  - `AmplifySourceBucket` - for hosting React UI assets

- **DynamoDB Tables:**
  - `InvoicesTable` (PK: InvoiceId) - stores all invoice records with validation status
  - `TaxRatesCache` (PK: Country-Region, SK: TaxType) - caches tax rates from API
  - `ProcessingLogsTable` (PK: LogId, SK: Timestamp) - audit trail for compliance

- **Lambda Functions (inline Python 3.11):**

  1. `InvoiceProcessorFunction` - S3 trigger handler, parses invoice, invokes Bedrock Agent
  2. `TaxLookupFunction` - Action Group handler for tax rate API calls (abstractTAPI.com)
  3. `CurrencyConversionFunction` - Action Group handler for Fixer.io API
  4. `ValidationFunction` - Action Group handler for business rule checks
  5. `PDFGeneratorFunction` - Creates PDF invoices using ReportLab
  6. `BedrockAgentSetupFunction` - Custom Resource to create/configure Bedrock Agent with Action Groups

- **IAM Roles (least privilege):**
  - `LambdaExecutionRole` - S3 read, DynamoDB read/write, CloudWatch logs
  - `BedrockAgentRole` - Bedrock model invocation, Lambda invoke
  - `CustomResourceRole` - Bedrock Agent API permissions

- **API Gateway REST API:**
  - `/status` endpoint for health checks
  - `/invoices` endpoint for querying processed invoices (future use)

### 2. Bedrock Agent Configuration

**Via Custom Resource Lambda:**

- Create Bedrock Agent named "GlobalInvoiceAI"
- Model: Claude 3.5 Sonnet (`us.anthropic.claude-3-5-sonnet-20241022-v2:0`)
- System Prompt: "You are an expert invoice validation and generation agent. Validate invoices for pricing discrepancies, missing fields, and tax compliance for US, UK, and India. Generate compliant invoices with proper tax calculations and multi-currency support."
- Create 3 Action Groups:

  1. **TaxOperations** → calls `TaxLookupFunction`

     - Functions: `get_tax_rate(country, region, tax_type)`, `validate_tax_calculation(amount, tax_rate, country)`

  1. **CurrencyOperations** → calls `CurrencyConversionFunction`

     - Functions: `convert_currency(amount, from_currency, to_currency)`, `get_exchange_rate(base, target)`

  1. **InvoiceOperations** → calls `ValidationFunction`

     - Functions: `validate_invoice_fields(invoice_data)`, `detect_discrepancies(invoice, purchase_order)`

### 3. Lambda Function Logic

**InvoiceProcessorFunction** (main orchestrator):

- Parse S3 event, read JSON/CSV invoice from S3
- Validate file format, extract invoice data
- Invoke Bedrock Agent with prompt: "Validate this invoice: {invoice_json}"
- Store result in DynamoDB `InvoicesTable`
- If valid, trigger PDFGeneratorFunction
- Send CloudWatch metric for processing time

**TaxLookupFunction**:

- Check DynamoDB `TaxRatesCache` first
- If miss, call abstractTAPI.com REST API
- Hardcoded fallback rates: US (varies by state, avg 7%), UK VAT 20%, India GST 18%
- Cache result in DynamoDB with 24h TTL

**CurrencyConversionFunction**:

- Call Fixer.io API with access key from environment variable
- Return conversion rate and converted amount
- Log API call to CloudWatch

**PDFGeneratorFunction**:

- Use ReportLab library (include in inline code or layer)
- Generate invoice PDF with proper formatting (support RTL for future Arabic)
- Upload to `ProcessedInvoicesBucket`

### 4. Admin UI (AWS Amplify)

**File:** `frontend/src/App.js` (React)

Features:

- **Login Page:** Cognito authentication
- **Dashboard:** 
  - Total invoices processed (query DynamoDB)
  - Error rate chart (CloudWatch metrics)
  - Recent processing logs table
- **Control Panel:**
  - Toggle tax regions (store in DynamoDB config table)
  - Set auto-approval threshold ($0-$10k)
- **Invoice Viewer:**
  - List all invoices with status filters
  - Download PDF button
  - View validation errors

**Amplify App Resource in CloudFormation:**

- Link to GitHub repo (manual step: push code first)
- Auto-deploy on push to main branch
- Environment variables: API Gateway URL, Cognito pool ID

**Cognito User Pool:**

- Email-based signup/login
- MFA optional
- Admin group with elevated permissions

### 5. Monitoring & Observability

**CloudWatch Dashboard:**

- Widgets:
  - Lambda invocation count/errors (all functions)
  - Bedrock Agent invocation count
  - DynamoDB read/write capacity
  - S3 bucket object count
  - Average invoice processing time

**CloudWatch Alarms:**

- High error rate (>5% in 5 min) → SNS notification
- Bedrock throttling errors
- Lambda timeout rate >10%

**CloudWatch Logs:**

- Centralized log group for all Lambda functions
- Retention: 7 days (cost optimization)

### 6. Hackathon Submission Package

**GitHub Repo Structure:**

```
/
├── cloudformation/
│   └── globalinvoiceai-stack.yaml (main template)
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.js
│   │   ├── components/
│   │   │   ├── Dashboard.js
│   │   │   ├── InvoiceList.js
│   │   │   └── ControlPanel.js
│   │   └── utils/api.js
│   ├── package.json
│   └── README.md
├── docs/
│   ├── architecture-diagram.png (create using draw.io XML)
│   ├── DEPLOYMENT.md (step-by-step guide)
│   └── DEMO_SCRIPT.md (3-min video walkthrough)
├── sample-data/
│   ├── invoice-us.json
│   ├── invoice-uk.json
│   └── invoice-india.json
├── README.md (main project description)
└── LICENSE
```

**README.md Contents:**

- Project title and tagline
- Problem statement (manual invoice processing pain)
- Solution overview (AI-powered autonomous validation)
- Architecture diagram embed
- Tech stack (AWS Bedrock, Lambda, S3, DynamoDB, Amplify)
- Key features (multi-currency, multi-tax, compliance)
- Deployment instructions (link to DEPLOYMENT.md)
- Demo video link (YouTube/Vimeo)
- ROI metrics (70% faster processing estimate)

**DEMO_SCRIPT.md:**

1. Show admin login (Cognito)
2. Upload sample invoice to S3 (via AWS Console or UI)
3. Watch dashboard update in real-time
4. Show processing log with Bedrock Agent reasoning
5. Download generated PDF
6. Show CloudWatch metrics

**Architecture Diagram (describe for manual creation):**

- User uploads invoice to S3 bucket
- S3 event triggers InvoiceProcessorFunction
- Lambda invokes Bedrock Agent
- Agent calls Action Groups (Tax, Currency, Validation Lambdas)
- Action Groups query external APIs (Fixer.io, abstractTAPI)
- Results stored in DynamoDB
- PDFGeneratorFunction creates output
- Admin views via Amplify UI (authenticated by Cognito)
- CloudWatch monitors everything

### 7. Security & Compliance

- **Encryption:** S3 buckets with AES-256, DynamoDB encryption at rest
- **IAM:** Least privilege roles, no wildcard permissions
- **API Keys:** Store Fixer.io and abstractTAPI keys in AWS Secrets Manager
- **Network:** VPC endpoints for Lambda (optional for production)
- **Logging:** All API calls logged for audit

### 8. Cost Optimization

- Lambda: Pay per invocation (~$0.0000002 per request)
- Bedrock: Pay per token (~$0.003/1K input, $0.015/1K output for Claude)
- S3: $0.023/GB storage + $0.0004/1K PUT
- DynamoDB: On-demand pricing
- Amplify: Free tier for small apps
- **Estimated idle cost:** <$1/month

## Deliverables

1. ✅ `cloudformation/globalinvoiceai-stack.yaml` - complete deployable template
2. ✅ `frontend/` - React admin UI with Cognito auth
3. ✅ `docs/DEPLOYMENT.md` - deployment guide
4. ✅ `docs/DEMO_SCRIPT.md` - video walkthrough script
5. ✅ `README.md` - project documentation
6. ✅ `sample-data/` - test invoices for 3 countries
7. ✅ Architecture diagram description (for draw.io)

## Notes

- Template will be ~1000-1500 lines (inline Lambda code)
- Python libraries: boto3 (built-in), requests (inline), reportlab (need Lambda layer or inline)
- Bedrock Agent setup may require manual alias creation after stack deployment
- Fixer.io free tier: 100 requests/month (sufficient for demo)
- abstractTAPI fallback to hardcoded rates if API unavailable

### To-dos

- [ ] Create complete CloudFormation YAML template with S3 buckets, DynamoDB tables, inline Lambda functions, IAM roles, and CloudWatch resources
- [ ] Implement Custom Resource Lambda for Bedrock Agent creation with Action Groups configuration
- [ ] Build React dashboard with Cognito authentication, invoice list, and monitoring widgets
- [ ] Create sample invoice JSON files for US, UK, and India with realistic data
- [ ] Write README.md, DEPLOYMENT.md, DEMO_SCRIPT.md, and architecture diagram description
- [ ] Set up complete GitHub repository structure with proper organization