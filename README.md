# OpenSearch Tutorial Application

This project demonstrates various OpenSearch search capabilities through a web application built with [Cloudscape React](https://cloudscape.design/) and AWS services.

## Overview

The application provides examples of different search functionalities using Amazon OpenSearch Service, including:

- Keyword Search
  - Prefix Match
  - Multi Match
  - Minimum Should Match
  - Wildcard Match
  - Range Filter
- Document Indexing
- OpenSearch Dashboard Integration

## Architecture
[TODO add architecture once on Github]

The application is built using:

- Frontend: React with Cloudscape Design System
- Backend: AWS Lambda functions / API Gateway
- Search: Amazon OpenSearch Service
- Infrastructure: AWS CDK
- Hosting: AWS App Runner
- Authentication: Amazon Cognito

## Prerequisites

- Node.js 16 or later
- Python 3.10 or later
- AWS CDK v2.91.0
- AWS CLI configured with appropriate credentials
- Docker (for UI builds)

## Infrastructure Setup

1. Head on to Amazon Cloudshell and clone the repository using the below command:
[TODO modify GITHUB link once available]
```bash
git clone https://github.com/aws-samples/serverless-rag-demo.git
```

2. Head on to the opensearch folder using the below command
[TODO add correct project name once its approved]
```bash
cd opensearch-tutorial
```

3. Deploy the infrastructure:
```bash
./builder.sh dev
```

The builder script will:
- Deploy the Lambda Layer Stack
- Build and deploy the OpenSearch Proxy Stack
- Build and deploy the UI container
- Deploy the App Runner hosting stack

## Environment Configuration

The application supports three environments:
- dev
- qa
- sandbox

Configuration for each environment is managed in `cdk.json`.

## Project Structure

```
.
├── app.py                      # CDK app entry point
├── artifacts/
│   ├── index_lambda/          # Document indexing function
│   ├── opensearch-app-ui/     # React frontend application
│   └── search_lambda/         # Search functionality
├── builder.sh                 # Deployment automation script
├── search_tutorials/          # CDK infrastructure stacks
└── requirements.txt           # Python dependencies
```

## Security

The application implements several security measures:
- Private VPC for OpenSearch domain
- AWS IAM roles and policies for service access
- HTTPS enforcement for all API endpoints
- Cognito user authentication

## Development

### Frontend Development

The UI is located in `artifacts/opensearch-app-ui/` and can be run locally:

```bash
cd artifacts/opensearch-app-ui
npm install
npm run dev
```

### Infrastructure Development

Infrastructure is defined using AWS CDK in the `search_tutorials/` directory:
- `lambda_layer_stack.py`: Lambda layers for dependencies
- `opensearch_proxy_stack.py`: OpenSearch domain and Lambda functions
- `apprunner_hosting_stack.py`: UI hosting configuration

## Deployment

The application can be deployed to different environments using the builder script:

```bash
./builder.sh <environment>
```

Where `<environment>` can be:
- dev
- qa
- sandbox

## License

This project is licensed under the terms specified in the project's LICENSE file.