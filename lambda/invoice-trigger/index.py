import json
import boto3
import os
import uuid
from datetime import datetime, timedelta
import base64

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
cloudwatch = boto3.client('cloudwatch')
ssm = boto3.client('ssm')

def handler(event, context):
    """Process S3 upload events and API Gateway requests"""
    try:
        # Check if this is an API Gateway event
        if 'httpMethod' in event:
            return handle_api_request(event, context)

        # Parse S3 event
        for record in event['Records']:
            bucket_name = record['s3']['bucket']['name']
            object_key = record['s3']['object']['key']

            print(f"Processing invoice: s3://{bucket_name}/{object_key}")

            # Read invoice file from S3
            response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            invoice_content = response['Body'].read().decode('utf-8')

            try:
                invoice_data = json.loads(invoice_content)
            except json.JSONDecodeError:
                # Try CSV format (simplified parsing)
                import csv
                import io
                csv_reader = csv.DictReader(io.StringIO(invoice_content))
                invoice_data = next(csv_reader)

            # Generate invoice ID
            invoice_id = str(uuid.uuid4())

            # Store initial record in DynamoDB
            invoices_table = dynamodb.Table(os.environ['INVOICES_TABLE'])
            invoices_table.put_item(Item={
                'InvoiceId': invoice_id,
                'Status': 'PROCESSING',
                'OriginalFileKey': object_key,
                'InvoiceData': invoice_data,
                'CreatedAt': datetime.utcnow().isoformat(),
                'UpdatedAt': datetime.utcnow().isoformat()
            })

            # Try to invoke AgentCore Runtime for validation (optional for testing)
            try:
                # Get AgentCore Runtime ARN from Parameter Store
                runtime_param = ssm.get_parameter(
                    Name=os.environ['AGENTCORE_RUNTIME_PARAM']
                )
                runtime_arn = runtime_param['Parameter']['Value']

                # Invoke AgentCore Runtime
                agentcore = boto3.client('bedrock-agentcore-runtime')
                response = agentcore.invoke_agent(
                    agentArn=runtime_arn,
                    runtimeEndpoint='DEFAULT',
                    prompt={
                        "invoice_data": invoice_data,
                        "operation": "validate",
                        "invoice_id": invoice_id
                    }
                )

                # Process streaming response
                full_response = ""
                for event in response.get('completion', []):
                    if 'chunk' in event:
                        full_response += event['chunk']['bytes'].decode('utf-8')

                # Parse and store result
                result = json.loads(full_response)
                invoices_table.update_item(
                    Key={'InvoiceId': invoice_id},
                    UpdateExpression='SET #status = :status, ValidationResult = :result, UpdatedAt = :updated',
                    ExpressionAttributeNames={'#status': 'Status'},
                    ExpressionAttributeValues={
                        ':status': result.get('status', 'VALIDATED'),
                        ':result': result,
                        ':updated': datetime.utcnow().isoformat()
                    }
                )

            except ssm.exceptions.ParameterNotFound:
                print("AgentCore Runtime not deployed yet - skipping validation for S3 upload")
                # Update status to indicate manual review needed
                invoices_table.update_item(
                    Key={'InvoiceId': invoice_id},
                    UpdateExpression='SET #status = :status, UpdatedAt = :updated',
                    ExpressionAttributeNames={'#status': 'Status'},
                    ExpressionAttributeValues={
                        ':status': 'NEEDS_REVIEW',
                        ':updated': datetime.utcnow().isoformat()
                    }
                )
            except Exception as e:
                print(f"AgentCore validation failed: {str(e)} - invoice uploaded but needs manual review")
                # Update status to indicate manual review needed
                invoices_table.update_item(
                    Key={'InvoiceId': invoice_id},
                    UpdateExpression='SET #status = :status, ValidationResult = :result, UpdatedAt = :updated',
                    ExpressionAttributeNames={'#status': 'Status'},
                    ExpressionAttributeValues={
                        ':status': 'VALIDATION_FAILED',
                        ':result': {'error': str(e)},
                        ':updated': datetime.utcnow().isoformat()
                    }
                )

            # Send CloudWatch metrics
            cloudwatch.put_metric_data(
                Namespace='GlobalInvoiceAI',
                MetricData=[
                    {
                        'MetricName': 'InvoiceProcessed',
                        'Value': 1,
                        'Unit': 'Count',
                        'Dimensions': [
                            {'Name': 'Environment', 'Value': os.environ['ENVIRONMENT']}
                        ]
                    },
                    {
                        'MetricName': 'ProcessingTime',
                        'Value': (datetime.utcnow() - datetime.fromisoformat(
                            invoices_table.get_item(Key={'InvoiceId': invoice_id})['Item']['CreatedAt']
                        )).total_seconds(),
                        'Unit': 'Seconds',
                        'Dimensions': [
                            {'Name': 'Environment', 'Value': os.environ['ENVIRONMENT']}
                        ]
                    }
                ]
            )

            print(f"Successfully processed invoice {invoice_id}")

    except Exception as e:
        print(f"Error processing invoice: {str(e)}")
        # Log error to DynamoDB
        logs_table = dynamodb.Table(os.environ['LOGS_TABLE'])
        logs_table.put_item(Item={
            'LogId': str(uuid.uuid4()),
            'Timestamp': datetime.utcnow().isoformat(),
            'Level': 'ERROR',
            'Message': str(e),
            'Source': 'InvoiceTriggerFunction'
        })

        # Send error metric
        cloudwatch.put_metric_data(
            Namespace='GlobalInvoiceAI',
            MetricData=[{
                'MetricName': 'ProcessingError',
                'Value': 1,
                'Unit': 'Count'
            }]
        )

        raise e

    return {"statusCode": 200, "body": "Processing complete"}

def cors_headers():
    """Return standard CORS headers"""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
    }

def handle_api_request(event, context):
    """Handle API Gateway requests"""
    try:
        http_method = event['httpMethod']
        path = event['path']
        path_parameters = event.get('pathParameters', {})
        query_parameters = event.get('queryStringParameters', {})

        # Route requests based on path and method
        if path == '/invoices' and http_method == 'GET':
            return get_invoices(query_parameters)
        elif path == '/invoices' and http_method == 'POST':
            return upload_invoice(event.get('body', '{}'))
        elif path == '/invoices/upload' and http_method == 'POST':
            return upload_invoice(event.get('body', '{}'))
        elif path == '/invoices/stats' and http_method == 'GET':
            return get_invoice_stats()
        elif path.startswith('/invoices/') and '/pdf' in path and http_method == 'GET':
            invoice_id = path_parameters.get('invoiceId')
            return get_invoice_pdf(invoice_id)
        elif path.startswith('/invoices/') and http_method == 'GET':
            invoice_id = path_parameters.get('invoiceId')
            return get_invoice(invoice_id)
        elif path == '/logs' and http_method == 'GET':
            return get_processing_logs(query_parameters)
        elif path == '/config' and http_method == 'GET':
            return get_system_config()
        elif path == '/config' and http_method == 'PUT':
            return update_system_config(event.get('body', '{}'))
        elif path == '/metrics' and http_method == 'GET':
            return get_metrics()
        else:
            return {
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    **cors_headers()
                },
                "body": json.dumps({"error": "Not found"})
            }

    except Exception as e:
        print(f"API Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": str(e)})
        }

def get_invoices(params):
    """Get list of invoices with optional filtering"""
    try:
        invoices_table = dynamodb.Table(os.environ['INVOICES_TABLE'])

        # Build scan parameters
        scan_params = {}
        filter_expression = None
        expression_values = {}

        # Filter by status if provided
        if 'status' in params:
            filter_expression = "#status = :status_val"
            expression_values[':status_val'] = params['status']
            scan_params['ExpressionAttributeNames'] = {'#status': 'Status'}
            scan_params['ExpressionAttributeValues'] = expression_values

        if filter_expression:
            scan_params['FilterExpression'] = filter_expression

        # Add pagination
        if 'limit' in params:
            scan_params['Limit'] = int(params['limit'])

        response = invoices_table.scan(**scan_params)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({
                "invoices": response.get('Items', []),
                "total": response.get('Count', 0)
            })
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": str(e)})
        }

def upload_invoice(body):
    """Handle manual invoice upload - generate presigned URL or accept JSON data"""
    try:
        # Parse request body
        request_data = json.loads(body) if body else {}
        
        # If this is a request for presigned URL (no invoice data yet)
        if request_data.get('action') == 'get_upload_url':
            invoice_id = str(uuid.uuid4())
            s3_key = f"uploads/{invoice_id}.json"
            upload_bucket = os.environ.get('UPLOAD_BUCKET', 'globalinvoiceai-invoice-upload-dev')
            
            # Generate presigned URL for direct S3 upload
            presigned_url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': upload_bucket,
                    'Key': s3_key,
                    'ContentType': 'application/json'
                },
                ExpiresIn=300  # 5 minutes
            )
            
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    **cors_headers()
                },
                "body": json.dumps({
                    "uploadUrl": presigned_url,
                    "invoiceId": invoice_id,
                    "s3Key": s3_key
                })
            }
        
        # Otherwise, accept invoice data directly
        invoice_data = request_data
        invoice_id = str(uuid.uuid4())
        s3_key = f"uploads/{invoice_id}.json"

        # Upload to S3
        upload_bucket = os.environ.get('UPLOAD_BUCKET', 'globalinvoiceai-invoice-upload-dev')
        s3_client.put_object(
            Bucket=upload_bucket,
            Key=s3_key,
            Body=json.dumps(invoice_data),
            ContentType='application/json'
        )

        # Store initial record in DynamoDB
        invoices_table = dynamodb.Table(os.environ['INVOICES_TABLE'])
        invoices_table.put_item(Item={
            'InvoiceId': invoice_id,
            'Status': 'UPLOADED',
            'OriginalFileKey': s3_key,
            'InvoiceData': invoice_data,
            'CreatedAt': datetime.utcnow().isoformat(),
            'UpdatedAt': datetime.utcnow().isoformat()
        })

        # AgentCore Runtime validation temporarily disabled
        # TODO: Re-enable once AgentCore runtime deployment is verified
        print("AgentCore Runtime validation disabled for testing - marking as NEEDS_REVIEW")
        invoices_table.update_item(
            Key={'InvoiceId': invoice_id},
            UpdateExpression='SET #status = :status, UpdatedAt = :updated',
            ExpressionAttributeNames={'#status': 'Status'},
            ExpressionAttributeValues={
                ':status': 'NEEDS_REVIEW',
                ':updated': datetime.utcnow().isoformat()
            }
        )

        # Send CloudWatch metric
        cloudwatch.put_metric_data(
            Namespace='GlobalInvoiceAI',
            MetricData=[{
                'MetricName': 'InvoiceUploaded',
                'Value': 1,
                'Unit': 'Count',
                'Dimensions': [
                    {'Name': 'Environment', 'Value': os.environ['ENVIRONMENT']}
                ]
            }]
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({
                "message": "Invoice uploaded successfully",
                "invoiceId": invoice_id,
                "status": "UPLOADED"
            })
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": str(e)})
        }

def get_invoice(invoice_id):
    """Get specific invoice details"""
    try:
        invoices_table = dynamodb.Table(os.environ['INVOICES_TABLE'])
        response = invoices_table.get_item(Key={'InvoiceId': invoice_id})

        if 'Item' not in response:
            return {
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    **cors_headers()
                },
                "body": json.dumps({"error": "Invoice not found"})
            }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps(response['Item'])
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": str(e)})
        }

def get_invoice_pdf(invoice_id):
    """Get invoice PDF - redirect to PDF generator"""
    try:
        # Check if invoice exists and is validated
        invoices_table = dynamodb.Table(os.environ['INVOICES_TABLE'])
        response = invoices_table.get_item(Key={'InvoiceId': invoice_id})

        if 'Item' not in response:
            return {
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    **cors_headers()
                },
                "body": json.dumps({"error": "Invoice not found"})
            }

        invoice = response['Item']
        if invoice.get('Status') != 'VALIDATED':
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    **cors_headers()
                },
                "body": json.dumps({"error": "Invoice not validated"})
            }

        # Trigger PDF generation
        pdf_generator = boto3.client('lambda')
        pdf_response = pdf_generator.invoke(
            FunctionName=os.environ.get('PDF_GENERATOR_FUNCTION', 'globalinvoiceai-pdf-generator-dev'),
            InvocationType='RequestResponse',
            Payload=json.dumps({'invoiceId': invoice_id})
        )

        if pdf_response['StatusCode'] != 200:
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    **cors_headers()
                },
                "body": json.dumps({"error": "PDF generation failed"})
            }

        pdf_result = json.loads(pdf_response['Payload'].read())
        if pdf_result.get('statusCode') != 200:
            return {
                "statusCode": pdf_result.get('statusCode', 500),
                "headers": {
                    "Content-Type": "application/json",
                    **cors_headers()
                },
                "body": json.dumps({"error": "PDF generation failed"})
            }

        # Get PDF from S3
        s3_response = s3_client.get_object(
            Bucket=os.environ['PROCESSED_BUCKET'],
            Key=f"pdfs/{invoice_id}.pdf"
        )

        pdf_content = s3_response['Body'].read()

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/pdf",
                "Content-Disposition": f"attachment; filename={invoice_id}.pdf",
                **cors_headers()
            },
            "body": base64.b64encode(pdf_content).decode('utf-8'),
            "isBase64Encoded": True
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": str(e)})
        }

def get_invoice_stats():
    """Get invoice processing statistics"""
    try:
        invoices_table = dynamodb.Table(os.environ['INVOICES_TABLE'])

        # Get all invoices for statistics
        response = invoices_table.scan()
        invoices = response.get('Items', [])

        total_invoices = len(invoices)
        processed_today = len([i for i in invoices if i.get('CreatedAt', '').startswith(datetime.utcnow().date().isoformat())])
        error_rate = len([i for i in invoices if i.get('Status') == 'ERROR']) / max(total_invoices, 1) * 100

        # Calculate average processing time (simplified)
        avg_time = 0  # Would need to implement proper calculation

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({
                "totalInvoices": total_invoices,
                "processedToday": processed_today,
                "errorRate": round(error_rate, 2),
                "averageProcessingTime": avg_time
            })
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": str(e)})
        }

def get_processing_logs(params):
    """Get processing logs"""
    try:
        logs_table = dynamodb.Table(os.environ['LOGS_TABLE'])

        scan_params = {}

        # Filter by invoice ID if provided
        if 'invoiceId' in params:
            scan_params['FilterExpression'] = 'InvoiceId = :invoice_id'
            scan_params['ExpressionAttributeValues'] = {':invoice_id': params['invoiceId']}

        if 'limit' in params:
            scan_params['Limit'] = int(params['limit'])

        response = logs_table.scan(**scan_params)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"logs": response.get('Items', [])})
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": str(e)})
        }

def get_system_config():
    """Get system configuration"""
    try:
        # Try to get configuration from Parameter Store
        config_param_name = f"/globalinvoiceai/config/{os.environ['ENVIRONMENT']}"

        try:
            response = ssm.get_parameter(Name=config_param_name)
            config = json.loads(response['Parameter']['Value'])
        except ssm.exceptions.ParameterNotFound:
            # Return default configuration if not found
            config = {
                "autoApprovalThreshold": 10000,
                "enabledCountries": ["US", "UK", "IN"],
                "maxProcessingTime": 300,
                "enablePDFGeneration": True,
                "enableEmailNotifications": False,
                "emailRecipients": "",
                "retryFailedInvoices": True,
                "maxRetries": 3,
                "supportedCurrencies": ["USD", "EUR", "GBP", "INR"],
                "taxRegions": ["US", "UK", "IN"],
                "maxFileSize": "10MB"
            }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps(config)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": str(e)})
        }

def update_system_config(body):
    """Update system configuration"""
    try:
        # Parse the configuration data
        config_data = json.loads(body)

        # Validate required fields (basic validation)
        required_fields = ['autoApprovalThreshold', 'enabledCountries', 'maxProcessingTime']
        for field in required_fields:
            if field not in config_data:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": f"Missing required field: {field}"})
                }

        # Store configuration in Parameter Store
        config_param_name = f"/globalinvoiceai/config/{os.environ['ENVIRONMENT']}"

        ssm.put_parameter(
            Name=config_param_name,
            Value=json.dumps(config_data),
            Type='String',
            Overwrite=True,
            Description='GlobalInvoiceAI system configuration'
        )

        # Log configuration change
        logs_table = dynamodb.Table(os.environ['LOGS_TABLE'])
        logs_table.put_item(Item={
            'LogId': str(uuid.uuid4()),
            'Timestamp': datetime.utcnow().isoformat(),
            'Level': 'INFO',
            'Message': 'System configuration updated',
            'Source': 'ConfigurationUpdate',
            'Details': config_data
        })

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({
                "message": "Configuration updated successfully",
                "config": config_data
            })
        }
    except json.JSONDecodeError:
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": "Invalid JSON in request body"})
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": str(e)})
        }

def get_metrics():
    """Get CloudWatch metrics"""
    try:
        cloudwatch = boto3.client('cloudwatch')

        # Get metrics for the last 24 hours
        response = cloudwatch.get_metric_data(
            MetricDataQueries=[
                {
                    'Id': 'invoice_count',
                    'MetricStat': {
                        'Metric': {
                            'Namespace': 'GlobalInvoiceAI',
                            'MetricName': 'InvoiceProcessed'
                        },
                        'Period': 3600,
                        'Stat': 'Sum'
                    }
                }
            ],
            StartTime=datetime.utcnow() - timedelta(hours=24),
            EndTime=datetime.utcnow()
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({
                "invoiceCount": response.get('MetricDataResults', [{}])[0].get('Values', []),
                "processingTime": [],
                "errorRate": []
            })
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                **cors_headers()
            },
            "body": json.dumps({"error": str(e)})
        }
