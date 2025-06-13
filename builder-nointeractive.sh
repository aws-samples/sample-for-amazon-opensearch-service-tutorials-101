#!/usr/bin/bash 
Green='\033[0;32m'
Red='\033[0;31m'
NC='\033[0m'

# Get account ID
account_id=$(aws sts get-caller-identity --query "Account" --output text)

if [ -z "$1" ]
then
    infra_env='dev'
else
    infra_env=$1
fi  

if [ $infra_env != "dev" -a $infra_env != "qa" -a $infra_env != "sandbox" -a $infra_env != "prod" ]
then
    echo "Environment name can only be dev or qa or sandbox or prod. example 'sh builder-noninteractive.sh dev' "
    exit 1
fi

echo "Environment: $infra_env"
echo ' '
echo '*************************************************************'
echo '*************************************************************'
echo ' Starting deployment ... '

deployment_region=$(aws ec2 describe-availability-zones --output text --query 'AvailabilityZones[0].RegionName')

# Attempt to create the service-linked role and suppress error output
if ! aws iam create-service-linked-role --aws-service-name opensearchservice.amazonaws.com 2>/dev/null; then
    # Check if the error was because the role already exists
    if aws iam get-role --role-name AWSServiceRoleForAmazonOpenSearchService >/dev/null 2>&1; then
        echo "Service-linked role already exists. Continuing..."
    else
        echo "Error creating service-linked role. Please check your permissions."
        exit 1
    fi
else
    echo "Service-linked role created successfully."
fi


cd ..
echo "--- Upgrading npm ---"
sudo npm install n stable -g
echo "--- Installing cdk ---"
sudo npm install -g aws-cdk@2.1018.0

echo "--- Bootstrapping CDK on account in region $deployment_region ---"
cdk bootstrap aws://$(aws sts get-caller-identity --query "Account" --output text)/$deployment_region

CURRENT_UTC_TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")

ls -lrt

cd src
echo "--- pip install requirements ---"
python3 -m pip install -r requirements.txt

echo "--- CDK synthesize ---"
cdk synth -c environment_name=$infra_env -c current_timestamp=$CURRENT_UTC_TIMESTAMP

echo "--- CDK deploy ---"
cdk deploy -c environment_name=$infra_env -c current_timestamp=$CURRENT_UTC_TIMESTAMP LambdaLayerStack"$infra_env" --require-approval never

echo "--- Get Build Container ---"
project=lambdaopnsrchbuild"$infra_env"
echo project: $project
build_container=$(aws codebuild list-projects|grep -o $project'[^,"]*')
echo container: $build_container
echo "--- Trigger Build ---"
BUILD_ID=$(aws codebuild start-build --project-name $build_container | jq '.build.id' -r)
echo Build ID : $BUILD_ID
if [ "$?" != "0" ]; then
    echo "Could not start CodeBuild project. Exiting."
    exit 1
else
    echo "Build started successfully."
fi

# Monitor the build
echo "Monitoring build progress..."
while true; do
  status=$(aws codebuild batch-get-builds --ids $BUILD_ID | jq -r '.builds[0].buildStatus')
  phase=$(aws codebuild batch-get-builds --ids $BUILD_ID | jq -r '.builds[0].currentPhase')
  
  echo "Current status: $status, Phase: $phase"
  
  if [ "$status" == "SUCCEEDED" ] || [ "$status" == "FAILED" ] || [ "$status" == "STOPPED" ]; then
    break
  else
    echo "Build is still in progress... sleeping for 60 seconds"
  fi
  
  sleep 60
done

if [ $status = "SUCCEEDED" ]
then
    cdk deploy -c environment_name=$infra_env -c current_timestamp=$CURRENT_UTC_TIMESTAMP OpensearchProxy"$infra_env" --require-approval never
else
    echo "Cannot deploy Opensearch stack as lambda_build has failed $status"
    exit 1
fi

echo "---Deploying Opensearch UI ECR image ---"
project=opnsrchuicntnr"$infra_env"
echo project: $project
build_container=$(aws codebuild list-projects|grep -o $project'[^,"]*')
echo container: $build_container
echo "--- Trigger UI Build ---"
BUILD_ID=$(aws codebuild start-build --project-name $build_container | jq '.build.id' -r)
echo Build ID : $BUILD_ID
if [ "$?" != "0" ]; then
    echo "Could not start OpensearchUI CodeBuild project. Exiting."
    exit 1
else
    echo "OpensearchUI Build started successfully."
fi

# Monitor the build
echo "Monitoring OpensearchUI build progress..."
while true; do
  status=$(aws codebuild batch-get-builds --ids $BUILD_ID | jq -r '.builds[0].buildStatus')
  phase=$(aws codebuild batch-get-builds --ids $BUILD_ID | jq -r '.builds[0].currentPhase')
  
  echo "Current status: $status, Phase: $phase"
  
  if [ "$status" == "SUCCEEDED" ] || [ "$status" == "FAILED" ] || [ "$status" == "STOPPED" ]; then
    break
  else
    echo "Build is still in progress... sleeping for 60 seconds"
  fi
  
  sleep 60
done

if [ $status = "SUCCEEDED" ]
    then
       echo "Host UI on AppRunner ..."
       cdk deploy -c environment_name=$infra_env -c current_timestamp=$CURRENT_UTC_TIMESTAMP ApprunnerHostingStack"$infra_env" --require-approval never
    else
       echo "Exiting. UI Build did not succeed."
       exit 1
fi

# Upload images to S3 bucket
echo "Uploading product images to S3 bucket..."

# Get bucket name from cdk.json based on environment
bucket_prefix=$(cat cdk.json | jq -r ".context.$infra_env.product_catalog_s3_bucket")
# Construct the full bucket name
bucket_name="${bucket_prefix}-${account_id}-${deployment_region}"
echo "Target S3 bucket: $bucket_name"

# Check if bucket exists
if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
    echo "S3 bucket exists, uploading images..."
    
    # Upload all images from artifacts/data directory
    aws s3 cp artifacts/data/ s3://$bucket_name/images/ --recursive
    
    if [ $? -eq 0 ]; then
        echo "Images uploaded successfully to s3://$bucket_name/images/"
    else
        echo "Error uploading images to S3 bucket"
    fi
else
    echo "Error: S3 bucket $bucket_name does not exist"
fi


echo "Deployment Complete"