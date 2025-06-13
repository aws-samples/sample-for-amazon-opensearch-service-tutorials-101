import os
import aws_cdk as _cdk
from aws_cdk import (
    # Duration,
    Stack,
    Tags,
    aws_ec2 as _ec2,
    aws_opensearchservice as _opensearch,
    aws_iam as _iam,
    aws_lambda as _lambda,
    aws_apigateway as _apigw,
    aws_cognito as _cognito,
    NestedStack,
    aws_s3 as _s3
)
import aws_cdk as cdk
from constructs import Construct
import cdk_nag as _cdk_nag
from aws_cdk import CustomResource
from aws_cdk import custom_resources as cr

from search_tutorials.ecr_ui_stack import ECRUIStack


class APIGWStack(NestedStack):

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        domain_endpoint: str,
        index_func_arn: str,
        search_func_arn: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)
        env_name = self.node.try_get_context("environment_name")
        account_id = os.getenv("CDK_DEFAULT_ACCOUNT")
        region = os.getenv("CDK_DEFAULT_REGION")
        env_params = self.node.try_get_context(env_name)
        parent_path = "search-tutorials"

        # Define Cognito
        # Create a user pool in cognito
        user_pool = _cognito.UserPool(
            self,
            f"opnsrch-usr-pool-{env_name}",
            user_pool_name=env_params["opensearch-user-pool"],
            self_sign_up_enabled=True,
            sign_in_aliases=_cognito.SignInAliases(email=True),
            standard_attributes=_cognito.StandardAttributes(
                email=_cognito.StandardAttribute(required=True, mutable=True)
            ),
            password_policy=_cognito.PasswordPolicy(
                min_length=8,
                require_digits=True,
                require_lowercase=True,
                require_uppercase=True,
                require_symbols=True,
            )
        )

        # for the user pool created above create a application client
        user_pool_client = _cognito.UserPoolClient(
            self,
            f"opnsrch-usr-pool-client-{env_name}",
            user_pool=user_pool,
            user_pool_client_name=f"search-tutorials-client-{env_name}",
            generate_secret=False,
            auth_flows=_cognito.AuthFlow(user_password=True, user_srp=True),
            id_token_validity=_cdk.Duration.days(1),
        )
        
        cognito_authorizer = _cdk.aws_apigateway.CognitoUserPoolsAuthorizer(
            self,
            f"opnsrch-cgnto-authrzr-{env_name}",
            cognito_user_pools=[user_pool],
            authorizer_name=env_params["opensearch-cognito"],
        )

        user_pool_client_id = user_pool_client.user_pool_client_id
        user_pool_id = user_pool.user_pool_id

        # Define API gateway proxy to lambda
        rest_api = _apigw.RestApi(
            self,
            f"opnsrch-demo-gw-{env_name}",
            rest_api_name=env_params["api_gateway_name"],
            deploy=True,
            endpoint_types=[_cdk.aws_apigateway.EndpointType.REGIONAL],
            cloud_watch_role=True,
            deploy_options={
                "stage_name": env_name,
                "throttling_rate_limit": 1000,
                "description": env_name + " stage deployment",
                "throttling_burst_limit": 1000,
            },
            description="Opensearch Proxy",
        )


        rest_endpoint_url = f"https://{rest_api.rest_api_id}.execute-api.{region}.amazonaws.com/{env_name}"

        opensearch_index_lambda = _lambda.Function.from_function_attributes(
            self, f"{env_name}_opnsrch_indx_lmbda", function_arn=index_func_arn, same_environment=True
        )
        opensearch_search_lambda = _lambda.Function.from_function_attributes(
            self, f"{env_name}_opnsrch_srch_lmbda", function_arn=search_func_arn, same_environment=True
        )

        namespace = rest_api.root.add_resource("proxy")

        index = rest_api.root.add_resource("index")
        index.add_method(
            "POST",
            _apigw.LambdaIntegration(opensearch_index_lambda),
            authorization_type=_apigw.AuthorizationType.COGNITO,
            authorization_scopes=None,
            authorizer=cognito_authorizer,
        )

        index.add_method(
            "DELETE",
            _apigw.LambdaIntegration(opensearch_index_lambda),
            authorization_type=_apigw.AuthorizationType.COGNITO,
            authorization_scopes=None,
            authorizer=cognito_authorizer,
        )

        index_custom_doc =rest_api.root.add_resource("index-custom-document")
        index_custom_doc.add_method(
            "POST",
            _apigw.LambdaIntegration(opensearch_index_lambda),
            authorization_type=_apigw.AuthorizationType.COGNITO,
            authorization_scopes=None,
            authorizer=cognito_authorizer,
        )

        vectorize_index = rest_api.root.add_resource("vectorize-index")
        vectorize_index.add_method(
            "POST",
            _apigw.LambdaIntegration(opensearch_index_lambda),
            authorization_type=_apigw.AuthorizationType.COGNITO,
            authorization_scopes=None,
            authorizer=cognito_authorizer,
        )

        vectorize_index.add_method(
            "DELETE",
            _apigw.LambdaIntegration(opensearch_index_lambda),
            authorization_type=_apigw.AuthorizationType.COGNITO,
            authorization_scopes=None,
            authorizer=cognito_authorizer,
        )
        # Add presigned URL endpoint
        presigned_url = rest_api.root.add_resource("presigned-url")
        presigned_url.add_method(
            "POST",
            _apigw.LambdaIntegration(opensearch_index_lambda),
            authorization_type=_apigw.AuthorizationType.COGNITO,
            authorization_scopes=None,
            authorizer=cognito_authorizer,
        )

        # Workarond: Imported lambda's dont retain resource policies, creating it here manually
        # https://github.com/aws/aws-cdk/issues/7588
        _lambda.CfnPermission(
            self,
            f"PIdxAllowLambdaInvoke",
            action="lambda:InvokeFunction",
            function_name=opensearch_index_lambda.function_name,
            principal="apigateway.amazonaws.com",
            source_arn=f"arn:aws:execute-api:{region}:{account_id}:{rest_api.rest_api_id}/*/POST/index",
            source_account=account_id,
        )
        
        _lambda.CfnPermission(
            self,
            f"ICustomDocAllowLambdaInvoke",
            action="lambda:InvokeFunction",
            function_name=opensearch_index_lambda.function_name,
            principal="apigateway.amazonaws.com",
            source_arn=f"arn:aws:execute-api:{region}:{account_id}:{rest_api.rest_api_id}/*/POST/index-custom-document",
            source_account=account_id,
        )

        _lambda.CfnPermission(
            self,
            f"DIdxAllowLambdaInvoke",
            action="lambda:InvokeFunction",
            function_name=opensearch_index_lambda.function_name,
            principal="apigateway.amazonaws.com",
            source_arn=f"arn:aws:execute-api:{region}:{account_id}:{rest_api.rest_api_id}/*/DELETE/index",
            source_account=account_id,
        )

        _lambda.CfnPermission(
            self,
            f"PPresignedAllowLambdaInvoke",
            action="lambda:InvokeFunction",
            function_name=opensearch_index_lambda.function_name,
            principal="apigateway.amazonaws.com",
            source_arn=f"arn:aws:execute-api:{region}:{account_id}:{rest_api.rest_api_id}/*/POST/presigned-url",
            source_account=account_id,
        )

        _lambda.CfnPermission(
            self,
            f"PSrchAllowLambdaInvoke",
            action="lambda:InvokeFunction",
            function_name=opensearch_search_lambda.function_name,
            principal="apigateway.amazonaws.com",
            source_arn=f"arn:aws:execute-api:{region}:{account_id}:{rest_api.rest_api_id}/*/POST/search",
            source_account=account_id,
        )

        _lambda.CfnPermission(
            self,
            f"PVectorizeAllowLambdaInvoke",
            action="lambda:InvokeFunction",
            function_name=opensearch_index_lambda.function_name,
            principal="apigateway.amazonaws.com",
            source_arn=f"arn:aws:execute-api:{region}:{account_id}:{rest_api.rest_api_id}/*/POST/vectorize-index",
            source_account=account_id,
        )

        _lambda.CfnPermission(
            self,
            f"DVectorizeAllowLambdaInvoke",
            action="lambda:InvokeFunction",
            function_name=opensearch_index_lambda.function_name,
            principal="apigateway.amazonaws.com",
            source_arn=f"arn:aws:execute-api:{region}:{account_id}:{rest_api.rest_api_id}/*/DELETE/vectorize-index",
            source_account=account_id,
        )

        search = rest_api.root.add_resource("search")
        search.add_method(
            "POST",
            _apigw.LambdaIntegration(opensearch_search_lambda),
            authorization_type=_apigw.AuthorizationType.COGNITO,
            authorization_scopes=None,
            authorizer=cognito_authorizer,
        )

        self.add_cors_options(index)
        self.add_cors_options(search)
        self.add_cors_options(presigned_url)
        self.add_cors_options(index_custom_doc)
        self.add_cors_options(vectorize_index)
        

        ecr_ui_stack = ECRUIStack(
            self,
            f"ECRUI{env_name}Stack",
            user_pool_id,
            user_pool_client_id,
            rest_endpoint_url,
        )
        self.tag_my_stack(ecr_ui_stack)
        
                # Create an S3 bucket
        s3_bucket = _s3.Bucket(
            self,
            f"opnsrch-s3-bucket-{env_name}",
            bucket_name=f"{env_params['product_catalog_s3_bucket']}-{account_id}-{region}",
            removal_policy=_cdk.RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            versioned=True,
            encryption=_s3.BucketEncryption.S3_MANAGED,
            block_public_access=_s3.BlockPublicAccess.BLOCK_ALL,
            cors=[
                _s3.CorsRule(
                    allowed_methods=[_s3.HttpMethods.GET, _s3.HttpMethods.PUT, _s3.HttpMethods.POST],
                    allowed_origins=["*"],  # In production, replace with specific origins
                    allowed_headers=["*"],
                    exposed_headers=["ETag"],
                    max_age=3000
                )
            ]
        )
        
        # Add bucket policy to enforce HTTPS connections (fix for AwsSolutions-S10)
        s3_bucket.add_to_resource_policy(
            _iam.PolicyStatement(
                sid="DenyHTTPRequests",
                effect=_iam.Effect.DENY,
                principals=[_iam.AnyPrincipal()],
                actions=["s3:*"],
                resources=[
                    s3_bucket.bucket_arn,
                    f"{s3_bucket.bucket_arn}/*"
                ],
                conditions={
                    "Bool": {
                        "aws:SecureTransport": "false"
                    }
                }
            )
        )
        
        # Add suppressions for S3 bucket
        self.suppressor(
            [s3_bucket],
            "AwsSolutions-S1",
            "Logging is deferred as this is a development/POC environment focusing on core functionality validation",
        )

        self.suppressor(
            [rest_api],
            "AwsSolutions-APIG2",
            "Request validation is deferred as this is a development/POC environment focusing on core functionality validation",
        )
        self.suppressor(
            [rest_api],
            "AwsSolutions-APIG4",
            "OPTIONS should not be blocked by authorization else the UI wont load",
        )
        self.suppressor(
            [rest_api],
            "AwsSolutions-COG4",
            "OPTIONS should not be blocked by authentication else the UI wont load",
        )

        self.stack_suppressor(
            self,
            "AwsSolutions-COG3",
            "Advanced security mode is off for this PoC due to changes in user pool feature plans",
        )
        
        self.stack_suppressor(
            self,
            "AwsSolutions-COG2",
            "MFA is off for this PoC",
        )

        self.stack_suppressor(
            self,
            "AwsSolutions-IAM5",
            "Not Implemented. BasicExecution role for a Lambda function allowing it to push logs to cloudwatch",
        )
        
        self.stack_suppressor(
            self,
            "AwsSolutions-L1",
            "Not Implemented. Already on Python 3_12",
        )

        self.stack_suppressor(
            self,
            "AwsSolutions-IAM4",
            "Basic lambda execution function to push logs to cloudwatch",
        )

        self.stack_suppressor(
            self,
            "AwsSolutions-APIG1",
            "Logging on API GW is deferred for this PoC",
        )

        self.stack_suppressor(
            self,
            "AwsSolutions-APIG1",
            "Logging on API GW is deferred for this PoC",
        )

        self.stack_suppressor(
            self,
            "AwsSolutions-APIG6",
            "Logging on API GW is deferred for this PoC",
        )

    def tag_my_stack(self, stack):
        tags = Tags.of(stack)
        tags.add("project", "aws-search-tutorials-demo")

    def add_cors_options(
        self, apiResource: _cdk.aws_apigateway.IResource
    ):
        apiResource.add_method(
            "OPTIONS",
            _cdk.aws_apigateway.MockIntegration(
                integration_responses=[
                    {
                        "statusCode": "200",
                        "responseParameters": {
                            "method.response.header.Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
                            "method.response.header.Access-Control-Allow-Origin": "'*'",
                            "method.response.header.Access-Control-Allow-Credentials": "'false'",
                            "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,GET,PUT,POST,DELETE'",
                        },
                    }
                ],
                passthrough_behavior=_cdk.aws_apigateway.PassthroughBehavior.NEVER,
                request_templates={"application/json": '{"statusCode": 200}'},
            ),
            method_responses=[
                {
                    "statusCode": "200",
                    "responseParameters": {
                        "method.response.header.Access-Control-Allow-Headers": True,
                        "method.response.header.Access-Control-Allow-Methods": True,
                        "method.response.header.Access-Control-Allow-Credentials": True,
                        "method.response.header.Access-Control-Allow-Origin": True,
                    },
                }
            ],
            authorization_type=_cdk.aws_apigateway.AuthorizationType.NONE
        )

    def suppressor(self, constructs, id, reason):
        reason = (
            reason
            + ". This is an example on building your first search application with Amazon Opensearch 101"
        )
        _cdk_nag.NagSuppressions.add_resource_suppressions(
            constructs,
            [_cdk_nag.NagPackSuppression(id=id, reason=reason)],
            apply_to_children=True,
        )

    def stack_suppressor(self, constructs, id, reason):
        reason = (
            "Not implemented. "
            + reason
            + ". The authentication is handled in the lambda function for this proxy resource"
        )
        _cdk_nag.NagSuppressions.add_stack_suppressions(
            constructs, [_cdk_nag.NagPackSuppression(id=id, reason=reason)]
        )
