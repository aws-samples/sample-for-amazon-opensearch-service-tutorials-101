from aws_cdk import (
    NestedStack,
    aws_apprunner as _runner,
    aws_ecr as _ecr,
    Stack,
    aws_codebuild as _codebuild,
    aws_s3 as _s3,
    aws_s3_notifications as _s3_notifications,
    aws_lambda as _lambda,
    aws_iam as _iam,
)

from constructs import Construct
import os
import aws_cdk as _cdk
import cdk_nag as _cdk_nag


# This stack will dockerize the latest UI build and upload it to ECR
class AppRunnerHostingStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)
        # Aspects.of(self).add(_cdk_nag.AwsSolutionsChecks())
        env_name = self.node.try_get_context("environment_name")
        config_details = self.node.try_get_context(env_name)

        account_id = os.getenv("CDK_DEFAULT_ACCOUNT")
        region = os.getenv("CDK_DEFAULT_REGION")
        current_timestamp = self.node.try_get_context("current_timestamp")

        ecr_repo_name = config_details["ecr_repository_name"]
        # Generate ECR Full repo name
        full_ecr_repo_name = f"{account_id}.dkr.ecr.{region}.amazonaws.com/{ecr_repo_name}:{current_timestamp}"

        apprunner_role = _iam.Role(
            self,
            f"apprnnr-opnsrch-tutorial-{env_name}",
            assumed_by=_iam.ServicePrincipal("build.apprunner.amazonaws.com"),
        )

        apprunner_role.add_to_policy(
            _iam.PolicyStatement(
                actions=[
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchCheckLayerAvailability",
                    "ecr:BatchGetImage",
                    "ecr:DescribeImages",
                    "ecr:GetAuthorizationToken",
                ],
                resources=["*"],
                effect=_iam.Effect.ALLOW,
            )
        )

        self.suppressor(
            apprunner_role,
            "AwsSolutions-IAM5",
            "This role allows apprunner to scan through all images in ECR",
        )

        app_runner_ui = _runner.CfnService(
            self,
            f"opensearch-tutorial-service-{env_name}",
            instance_configuration=_runner.CfnService.InstanceConfigurationProperty(
                cpu="2048", memory="4096"
            ),
            service_name=config_details["apprunner_service_name"],
            source_configuration=_runner.CfnService.SourceConfigurationProperty(
                auto_deployments_enabled=True,
                authentication_configuration=_runner.CfnService.AuthenticationConfigurationProperty(
                    access_role_arn=apprunner_role.role_arn
                ),
                image_repository=_runner.CfnService.ImageRepositoryProperty(
                    image_identifier=full_ecr_repo_name,
                    image_repository_type="ECR",
                    image_configuration=_runner.CfnService.ImageConfigurationProperty(
                        port="80",
                        runtime_environment_variables=[
                            _runner.CfnService.KeyValuePairProperty(
                                name="name", value="value"
                            )
                        ],
                    ),
                ),
            ),
        )

        _cdk.CfnOutput(
            self,
            f"apprunner-url-{env_name}",
            value=app_runner_ui.attr_service_url,
            export_name=f"ServiceUrl-{env_name}",
        )

    def suppressor(self, constructs, id, reason):
        reason = (
            "Not Implemented."
            + reason
            + ". This is an example on building your first search application with Amazon Opensearch 101"
        )
        _cdk_nag.NagSuppressions.add_resource_suppressions(
            constructs,
            [_cdk_nag.NagPackSuppression(id=id, reason=reason)],
            apply_to_children=True,
        )
