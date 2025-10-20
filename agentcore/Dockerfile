FROM public.ecr.aws/lambda/python:3.11

COPY invoice_agent.py requirements.txt ./

RUN pip install -r requirements.txt

# BedrockAgentCoreApp handles the Lambda runtime automatically
CMD ["python", "invoice_agent.py"]
