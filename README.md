# OpenSearch Tutorial Application

This project demonstrates various OpenSearch search capabilities through a web application built with [Cloudscape React](https://cloudscape.design/) and AWS services.

## Overview

The application provides examples of different search functionalities using Amazon OpenSearch Service, including:

- Keyword Search
  - Prefix Match
  - Multi Match
  - Fuzzy Search
  - Minimum Should Match
  - Wildcard Match
  - Range Filter
  - Compound Queries
  - Aggregations
- Semantic Search (Disk vs In-Memory modes)
- Hybrid Search (Disk vs In-Memory modes)
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
<img width="697" alt="cloudshell-deployment" src="https://github.com/user-attachments/assets/f59375cd-0ab1-4c75-92d0-898878903f97" />


4. Deploy the infrastructure:
```bash
sh installer.sh
```
Note: triggering builder.sh directly runs the script in Cloudshell which could terminate due to inactivity. We recommend running installer.sh which triggers a codebuild job.

5. Press Enter to confirm deployment

6. The deployment takes 30 minutes to create all resources. You can track its progress on Cloudformation
   <img width="1128" alt="Screenshot 2025-04-01 at 4 55 24 pm" src="https://github.com/user-attachments/assets/7d9df31b-47ba-4554-8730-69ec153dbe2a" />

7. Once done, head to AppRunner to obtain the application url
    <img width="1037" alt="Screenshot 2025-04-01 at 4 56 45 pm" src="https://github.com/user-attachments/assets/8f4de24f-08e6-42d0-ac7f-b0168d0552d1" />

8. Get started by first creating your account on the Opensearch tutorial Application
   <img width="1219" alt="Screenshot 2025-04-01 at 5 01 51 pm" src="https://github.com/user-attachments/assets/3929334e-ebb7-4fe7-a4ee-e919bb641035" />

9. To test out Keyword search functionality, first index some products on the Opensearch tutorial application. Every feature is also accompanied by a guide, best practices and links to the Opensearch documentation. You could also index a custom product.
   <img width="1424" alt="Opensearch-UI-tutorial" src="https://github.com/user-attachments/assets/10ad1c92-2781-4d6c-897d-33f69b4e86f2" />

10. Updated features
    <img width="1408" alt="lexical-semantic-search" src="https://github.com/user-attachments/assets/58337bc5-915e-4496-b86a-bc0f8f494d53" />




**Note:** The builder script will:
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

## Cleanup

Delete all the deployed resources
```bash
cdk destroy

```


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

- DeepWiki Docs : https://deepwiki.com/aws-samples/sample-for-amazon-opensearch-tutorials-101
