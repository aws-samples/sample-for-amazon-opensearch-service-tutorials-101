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
)
import aws_cdk as cdk
from constructs import Construct
import cdk_nag as _cdk_nag

from search_tutorials.api_gateway_stack import APIGWStack
from search_tutorials.ecr_ui_stack import ECRUIStack
from search_tutorials.lambda_layer_stack import LambdaLayerStack


class OpensearchProxyStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)
        env_name = self.node.try_get_context("environment_name")
        account_id = os.getenv("CDK_DEFAULT_ACCOUNT")
        region = os.getenv("CDK_DEFAULT_REGION")
        env_params = self.node.try_get_context(env_name)
        parent_path = "search-tutorials"
        # Define a private Opensearch cluster
        vpc = _ec2.Vpc(
            self,
            f"vpc{env_name}",
            vpc_name=env_params["vpc_name"],
            subnet_configuration=[
                _ec2.SubnetConfiguration(
                    name="private",
                    subnet_type=_ec2.SubnetType.PRIVATE_ISOLATED,
                    cidr_mask=24,
                ),
                _ec2.SubnetConfiguration(
                    name="public", subnet_type=_ec2.SubnetType.PUBLIC, cidr_mask=24
                ),
            ],
        )

        private_subnets = vpc.private_subnets
        private_subnets_required = []
        for i in range(env_params["data_nodes"]):
            if i < len(private_subnets):
                private_subnets_required.append(vpc.private_subnets[i].subnet_id)

        opensearch_demo_sg = _ec2.SecurityGroup(
            self,
            f"opnsrch_{env_name}_demo_sg",
            vpc=vpc,
            security_group_name=env_params["opensearch_demo_sg_name"],
            allow_all_outbound=True,
        )

        self.suppressor(
            [vpc], "AwsSolutions-VPC7", "VPC flows logs add to the cost of the project"
        )

        # Create the opensearch domain
        domain = _opensearch.Domain(
            self,
            f"opnsrch_{env_name}_domain",
            version=_opensearch.EngineVersion.OPENSEARCH_2_7,
            vpc=vpc,
            vpc_subnets=[
                {"subnet_filters": [_ec2.SubnetFilter.by_ids(private_subnets_required)]}
            ],
            security_groups=[opensearch_demo_sg],
            domain_name=env_params["opensearch_domain_name"],
            node_to_node_encryption=True,
            enforce_https=True,
            encryption_at_rest={"enabled": True},
            removal_policy=cdk.RemovalPolicy.DESTROY,
            capacity=_opensearch.CapacityConfig(
                multi_az_with_standby_enabled=False,
                data_nodes=env_params["data_nodes"],
                data_node_instance_type=env_params["opensearch_instance_type"],
            ),
            zone_awareness=_opensearch.ZoneAwarenessConfig(
                enabled=True, availability_zone_count=env_params["data_nodes"]
            ),
            ebs=_opensearch.EbsOptions(
                volume_size=env_params["volume_size"],
                volume_type=_ec2.EbsDeviceVolumeType.GP2,
            ),
            advanced_options={"override_main_response_version": "true"},
        )

        domain.add_access_policies(
            _iam.PolicyStatement(
                actions=["es:DescribeDomain", "es:ESHttp*"],
                effect=_iam.Effect.ALLOW,
                principals=[_iam.AccountPrincipal(account_id)],
                resources=[domain.domain_arn, f"{domain.domain_arn}/*"],
            )
        )

        self.suppressor(
            [domain],
            "AwsSolutions-OS3",
            "Opensearch is in a private subnet and is accessbile only via an IAM role",
        )
        self.suppressor(
            [domain],
            "AwsSolutions-OS4",
            "This is a demo, master nodes would add to the cost of the project",
        )
        self.suppressor(
            [domain],
            "AwsSolutions-OS9",
            "This is a demo, slow_logs dont need to be enabled",
        )

        # Define an API Gateway + Lambda proxy to Opensearch
        custom_lambda_role = _iam.Role(
            self,
            f"lmbda_opnsrch_dmo_role_{env_name}",
            role_name=env_params["lambda_role_name"] + "_" + region,
            assumed_by=_iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                _iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                )
            ],
        )
        self.stack_suppressor(
            self,
            "AwsSolutions-IAM4",
            "This is a minimum set of permissions needed by lambda to push logs to cloudwatch",
        )

        self.stack_suppressor(
            self,
            "AwsSolutions-IAM5",
            "The lambda is part of a VPC and needs to create necessary ec2 components for which the wildcard is needed",
        )

        opensearch_utils_layer = _lambda.LayerVersion.from_layer_version_arn(
            self,
            f"opnsrch-utls-lyr-{env_name}",
            f'arn:aws:lambda:{region}:{account_id}:layer:{env_params["opensearch_utils_layer_name"]}:1',
        )

        opensearch_index_lambda = _lambda.Function(
            self,
            f"opnsrch-indx-{env_name}",
            function_name=env_params["index_lambda_function_name"],
            code=_lambda.Code.from_asset(
                os.path.join(os.getcwd(), "artifacts/index_lambda/")
            ),
            runtime=_lambda.Runtime.PYTHON_3_10,
            handler="opensearch_index.handler",
            role=custom_lambda_role,
            timeout=_cdk.Duration.seconds(300),
            description="Access to private Opensearch Cluster",
            memory_size=3000,
            layers=[opensearch_utils_layer],
            vpc=vpc,
            environment={"OPENSEARCH_HOST": domain.domain_endpoint},
        )

        opensearch_search_lambda = _lambda.Function(
            self,
            f"opnsrch-srch-{env_name}",
            function_name=env_params["search_lambda_function_name"],
            code=_lambda.Code.from_asset(
                os.path.join(os.getcwd(), "artifacts/search_lambda/")
            ),
            runtime=_lambda.Runtime.PYTHON_3_10,
            handler="opensearch_search.handler",
            role=custom_lambda_role,
            timeout=_cdk.Duration.seconds(300),
            description="Access to private Opensearch Cluster",
            memory_size=3000,
            layers=[opensearch_utils_layer],
            vpc=vpc,
            environment={"OPENSEARCH_HOST": domain.domain_endpoint},
        )

        opensearch_access_policy_1 = _iam.PolicyStatement(
            actions=[
                "ec2:CreateNetworkInterface",
                "ec2:DescribeNetworkInterfaces",
                "ec2:DeleteNetworkInterface",
            ],
            resources=["*"],
        )

        opensearch_access_policy_2 = _iam.PolicyStatement(
            actions=[
                "es:ESHttpHead",
                "es:ESHttpPost",
                "es:ESHttpGet",
                "es:ESHttpDelete",
                "logs:CreateLogGroup",
                "es:ESHttpPut",
            ],
            resources=[
                f"{domain.domain_arn}",
                f"{domain.domain_arn}/*",
                f"arn:aws:logs:{region}:{account_id}:*",
            ],
        )
        domain.connections.allow_from(opensearch_index_lambda, _ec2.Port.tcp(443))
        domain.connections.allow_from(opensearch_search_lambda, _ec2.Port.tcp(443))

        opensearch_index_lambda.add_to_role_policy(opensearch_access_policy_1)
        opensearch_index_lambda.add_to_role_policy(opensearch_access_policy_2)
        opensearch_search_lambda.add_to_role_policy(opensearch_access_policy_1)
        opensearch_search_lambda.add_to_role_policy(opensearch_access_policy_2)
        self.stack_suppressor(
            self,
            "AwsSolutions-L1",
            "Deferred. We are on 3_10 which is just one lower than the latest",
        )

        # Enable adding suppressions to child constructs
        _cdk_nag.NagSuppressions.add_resource_suppressions(
            [opensearch_index_lambda, opensearch_search_lambda],
            [
                _cdk_nag.NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="Not Implemented. BasicExecution role for a Lambda function allowing it to push logs to cloudwatch",
                    applies_to=[
                        "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
                    ],
                )
            ],
            True,
        )

        api_gw_stack = APIGWStack(
            self,
            f"APIGWOpnsrch{env_name}Stack",
            domain.domain_endpoint,
            opensearch_index_lambda.function_arn,
            opensearch_search_lambda.function_arn,
        )
        self.tag_my_stack(api_gw_stack)

    def tag_my_stack(self, stack):
        tags = Tags.of(stack)
        tags.add("project", "aws-search-tutorials-demo")

    def suppressor(self, constructs, id, reason):
        reason = (
            "Not implemented. "
            + reason
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
            + ". Deferred as this is a development/POC environment focusing on core functionality validation"
        )
        _cdk_nag.NagSuppressions.add_stack_suppressions(
            constructs, [_cdk_nag.NagPackSuppression(id=id, reason=reason)]
        )
