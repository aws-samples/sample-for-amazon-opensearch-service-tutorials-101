#!/usr/bin/bash 
Green='\033[0;32m'
Red='\033[0;31m'
NC='\033[0m'

if [ -z "$1" ]
then
    infra_env='dev'
else
    infra_env=$1
fi  

if [ $infra_env != "dev" -a $infra_env != "qa" -a $infra_env != "sandbox" ]
then
    echo "Environment name can only be dev or qa or sandbox. example 'sh builder.sh dev' "
    exit 1
fi

echo "Environment: $infra_env"
echo ' '
echo '*************************************************************'
printf "$Green Press Enter to proceed with deployment else ctrl+c to cancel $NC "
read -p " "
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
sudo npm install -g aws-cdk@2.91.0

echo "--- Bootstrapping CDK on account in region $deployment_region ---"
cdk bootstrap aws://$(aws sts get-caller-identity --query "Account" --output text)/$deployment_region

CURRENT_UTC_TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")

cd sample-for-amazon-opensearch-tutorials-101
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

echo "Check build status every 30 seconds. Wait for codebuild to finish"
j=0
while [ $j -lt 50 ];
do 
    sleep 30
    echo 'Wait for 30 seconds. Build job typically takes 15 minutes to complete...'
    build_status=$(aws codebuild batch-get-builds --ids $BUILD_ID | jq -cs '.[0]["builds"][0]["buildStatus"]')
    build_status="${build_status%\"}"
    build_status="${build_status#\"}"
    if [ $build_status = "SUCCEEDED" ] || [ $build_status = "FAILED" ] || [ $build_status = "STOPPED" ]
    then
        echo "Build complete: $latest_build : status $build_status"
        break
    fi
    ((j++))
done

if [ $build_status = "SUCCEEDED" ]
then
    cdk deploy -c environment_name=$infra_env -c current_timestamp=$CURRENT_UTC_TIMESTAMP OpensearchProxy"$infra_env" --require-approval never
else
    echo "Cannot deploy Opensearch stack as lambda_build has failed $build_status"
fi

echo "---Deploying the UI ---"
project=opnsrchuicntnr"$infra_env"
echo project: $project
build_container=$(aws codebuild list-projects|grep -o $project'[^,"]*')
echo container: $build_container
echo "--- Trigger UI Build ---"
BUILD_ID=$(aws codebuild start-build --project-name $build_container | jq '.build.id' -r)
echo Build ID : $BUILD_ID
if [ "$?" != "0" ]; then
    echo "Could not start UI CodeBuild project. Exiting."
    exit 1
else
    echo "UI Build started successfully."
fi

echo "Check UI build status every 30 seconds. Wait for codebuild to finish"
j=0
while [ $j -lt 50 ];
do 
    sleep 10
    echo 'Wait for 30 seconds. Build job typically takes 5 minutes to complete...'
    build_status=$(aws codebuild batch-get-builds --ids $BUILD_ID | jq -cs '.[0]["builds"][0]["buildStatus"]')
    build_status="${build_status%\"}"
    build_status="${build_status#\"}"
    if [ $build_status = "SUCCEEDED" ] || [ $build_status = "FAILED" ] || [ $build_status = "STOPPED" ]
    then
        echo "Build complete: $latest_build : status $build_status"
        break
    fi
    ((j++))
done

if [ $build_status = "SUCCEEDED" ]
    then
       echo "Host UI on AppRunner..."
       cdk deploy -c environment_name=$infra_env -c current_timestamp=$CURRENT_UTC_TIMESTAMP AppRunnerHosting"$infra_env"Stack --require-approval never
    else
       echo "Exiting. Build did not succeed."
       exit 1
fi

echo "Deployment Complete"
    