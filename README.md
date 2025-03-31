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

## Architecture
![Architecture](https://github.com/user-attachments/assets/f94f0292-29f6-4cc6-b9a8-dc262e9215f0)

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

## Deployment Steps

1. Search for Cloudshell service on the AWS Console and follow the steps below to clone the github repository
   <img width="1069" alt="Cloudshell-service" src="https://github.com/user-attachments/assets/e3f2b6fa-1dbb-46cc-840f-8fd739aad7fe" />

   
2. Clone the **sample-for-amazon-opensearch-tutorials-101** repository using the below command:
   
```bash
git clone https://github.com/aws-samples/sample-for-amazon-opensearch-tutorials-101.git
```

3. Head on to the **sample-for-amazon-opensearch-tutorials-101** folder using the below command
   
```bash
cd sample-for-amazon-opensearch-tutorials-101
```
<img width="1080" alt="git-clone-cloudshell" src="https://github.com/user-attachments/assets/bf7243eb-3388-40f9-894f-76d321ffe9b9" />

4. Deploy the infrastructure:
```bash
sh builder.sh
```

5. Press Enter to confirm deployment

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
- dev [default]
- qa
- sandbox
