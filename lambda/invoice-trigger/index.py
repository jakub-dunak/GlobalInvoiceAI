import json
import boto3
import os
import uuid
from datetime import datetime
import base64

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
cloudwatch = boto3.client('cloudwatch')
ssm = boto3.client('ssm')

def handler(event, context):
    """Process S3 upload events and trigger AgentCore Runtime"""
    try:
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

            # Get AgentCore Runtime ARN from Parameter Store
            try:
                runtime_param = ssm.get_parameter(
                    Name=os.environ['AGENTCORE_RUNTIME_PARAM']
                )
                runtime_arn = runtime_param['Parameter']['Value']
            except ssm.exceptions.ParameterNotFound:
                print("AgentCore Runtime not deployed yet")
                return {"statusCode": 500, "body": "AgentCore Runtime not available"}

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
                    ':status': result.get('status', 'ERROR'),
                    ':result': result,
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
