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
            ),
            advanced_security_mode=_cognito.AdvancedSecurityMode.ENFORCED,
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
        # create an api gateway authorizer with the cognito user pool above
        # create an api gateway authorizer with the cognito user pool above
        cognito_authorizer = _cdk.aws_apigateway.CognitoUserPoolsAuthorizer(
            self,
            f"opnsrch-cgnto-authrzr-{env_name}",
            cognito_user_pools=[user_pool],
            authorizer_name=env_params["opensearch-cognito"],
        )

        user_pool_client_id = user_pool_client.user_pool_client_id
        user_pool_id = user_pool.user_pool_id

        log_group = _cdk.aws_logs.LogGroup(
            self,
            f"ApiGatewayAccessLogs-{env_name}",
            retention=_cdk.aws_logs.RetentionDays.ONE_WEEK,
        )

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


        rest_endpoint_url = f"https://{rest_api.rest_api_id}.execute-api.{region}.amazonaws.com/{env_name}/{parent_path}/"

        opensearch_index_lambda = _lambda.Function.from_function_arn(
            self, f"{env_name}_opnsrch_indx_lmbda", function_arn=index_func_arn
        )
        opensearch_search_lambda = _lambda.Function.from_function_arn(
            self, f"{env_name}_opnsrch_srch_lmbda", function_arn=search_func_arn
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
            f"DIdxAllowLambdaInvoke",
            action="lambda:InvokeFunction",
            function_name=opensearch_index_lambda.function_name,
            principal="apigateway.amazonaws.com",
            source_arn=f"arn:aws:execute-api:{region}:{account_id}:{rest_api.rest_api_id}/*/DELETE/index",
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

        search = rest_api.root.add_resource("search")
        search.add_method(
            "POST",
            _apigw.LambdaIntegration(opensearch_search_lambda),
            authorization_type=_apigw.AuthorizationType.COGNITO,
            authorization_scopes=None,
            authorizer=cognito_authorizer,
        )

        self.add_cors_options(index, cognito_authorizer)
        self.add_cors_options(search, cognito_authorizer)

        ecr_ui_stack = ECRUIStack(
            self,
            f"ECRUI{env_name}Stack",
            user_pool_id,
            user_pool_client_id,
            rest_endpoint_url,
        )
        self.tag_my_stack(ecr_ui_stack)

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
        self, apiResource: _cdk.aws_apigateway.IResource, cognito_authorizer
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
