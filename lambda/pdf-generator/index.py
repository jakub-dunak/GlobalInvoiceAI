import json
import boto3
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
import io

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

def handler(event, context):
    """Generate PDF invoice from validated invoice data"""
    try:
        # Handle API Gateway events
        if 'httpMethod' in event:
            invoice_id = event.get('pathParameters', {}).get('invoiceId')
            if not invoice_id:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
                    },
                    "body": json.dumps({"error": "Missing invoiceId"})
                }
        else:
            # Direct Lambda invocation
            invoice_id = event['invoiceId']

        # Get invoice data from DynamoDB
        invoices_table = dynamodb.Table(os.environ['INVOICES_TABLE'])
        response = invoices_table.get_item(Key={'InvoiceId': invoice_id})

        if 'Item' not in response:
            return {
                "statusCode": 404,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": os.environ.get('AMPLIFY_DOMAIN', '*'),
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
                },
                "body": json.dumps({"error": "Invoice not found"})
            }

        invoice = response['Item']
        if invoice['Status'] != 'VALIDATED':
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": os.environ.get('AMPLIFY_DOMAIN', '*'),
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
                },
                "body": json.dumps({"error": "Invoice not validated"})
            }

        # Generate PDF
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []

        # Title
        title = Paragraph(f"INVOICE #{invoice_id}", styles['Title'])
        story.append(title)
        story.append(Spacer(1, 12))

        # Invoice details table
        invoice_data = invoice.get('InvoiceData', {})
        details_data = [
            ['Invoice Number', invoice_id],
            ['Date', datetime.utcnow().strftime('%Y-%m-%d')],
            ['Customer', invoice_data.get('customer_name', 'N/A')],
            ['Total Amount', f"${invoice_data.get('total_amount', 0):.2f}"],
            ['Tax Amount', f"${invoice_data.get('tax_amount', 0):.2f}"],
            ['Currency', invoice_data.get('currency', 'USD')]
        ]

        details_table = Table(details_data, colWidths=[100, 300])
        details_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))

        story.append(details_table)
        story.append(Spacer(1, 20))

        # Line items (if available)
        if 'line_items' in invoice_data:
            items_title = Paragraph("Line Items", styles['Heading2'])
            story.append(items_title)
            story.append(Spacer(1, 12))

            items_data = [['Description', 'Quantity', 'Unit Price', 'Total']]
            for item in invoice_data['line_items']:
                items_data.append([
                    item.get('description', ''),
                    str(item.get('quantity', 0)),
                    f"${item.get('unit_price', 0):.2f}",
                    f"${item.get('total', 0):.2f}"
                ])

            items_table = Table(items_data, colWidths=[200, 60, 80, 80])
            items_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))

            story.append(items_table)

        # Build PDF
        doc.build(story)

        # Upload PDF to S3
        pdf_key = f"invoice-{invoice_id}.pdf"
        pdf_buffer.seek(0)
        s3_client.put_object(
            Bucket=os.environ['PROCESSED_BUCKET'],
            Key=pdf_key,
            Body=pdf_buffer.getvalue(),
            ContentType='application/pdf',
            Metadata={
                'invoice-id': invoice_id,
                'generated-at': datetime.utcnow().isoformat()
            }
        )

        # Update invoice record with PDF location
        invoices_table.update_item(
            Key={'InvoiceId': invoice_id},
            UpdateExpression='SET PDFLocation = :pdf',
            ExpressionAttributeValues={':pdf': pdf_key}
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": os.environ.get('AMPLIFY_DOMAIN', '*'),
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
            },
            "body": json.dumps({
                "invoiceId": invoice_id,
                "pdfLocation": pdf_key,
                "bucket": os.environ['PROCESSED_BUCKET']
            })
        }

    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        raise e
