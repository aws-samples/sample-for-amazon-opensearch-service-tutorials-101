import json
from aws_cdk import (
    NestedStack,
    Stack,
    aws_apprunner as _runner,
    aws_ecr as _ecr,
    aws_cognito as _cognito,
    aws_codebuild as _codebuild,
    aws_iam as _iam,
    aws_kms as _kms,
)

from constructs import Construct
import os
import yaml
import aws_cdk as _cdk
import cdk_nag as _cdk_nag


# This stack will dockerize the latest UI build and upload it to ECR
class ECRUIStack(NestedStack):

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        pool_id: str,
        client_id: str,
        rest_endpoint_url,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)
        # Aspects.of(self).add(_cdk_nag.AwsSolutionsChecks())
        env_name = self.node.try_get_context("environment_name")
        config_details = self.node.try_get_context(env_name)

        ecr_repo_name = config_details["ecr_repository_name"]
        account_id = os.getenv("CDK_DEFAULT_ACCOUNT")
        region = os.getenv("CDK_DEFAULT_REGION")
        current_timestamp = self.node.try_get_context("current_timestamp")

        # Generate ECR Full repo name
        full_ecr_repo_name = f"{account_id}.dkr.ecr.{region}.amazonaws.com/{ecr_repo_name}:{current_timestamp}"

        ecr_repo_ui = _ecr.Repository(
            self,
            ecr_repo_name,
            repository_name=ecr_repo_name,
            removal_policy=_cdk.RemovalPolicy.DESTROY,
            auto_delete_images=True,
        )

        ecr_repo_ui.add_lifecycle_rule(
            tag_status=_ecr.TagStatus.ANY, max_image_count=10
        )
        ecr_repo_ui.add_lifecycle_rule(
            tag_status=_ecr.TagStatus.UNTAGGED, max_image_age=_cdk.Duration.days(1)
        )

        build_spec_yml = ""
        with open("buildspec_dockerize_ui.yml", "r") as stream:
            try:
                build_spec_yml = yaml.safe_load(stream)
            except yaml.YAMLError as exc:
                print(exc)

        encryption_key = _kms.Key(
            self,
            "CodeBuildEncryptionKey",
            enable_key_rotation=True,  # Best practice to enable key rotation
            alias=f"alias/cb-docker-encryptn-{env_name}-ky",
            description="KMS key for CodeBuild artifacts encryption",
        )

        # Add necessary permissions to the key
        encryption_key.add_to_resource_policy(
            _iam.PolicyStatement(
                sid="Allow CodeBuild to use the key",
                actions=[
                    "kms:Decrypt",
                    "kms:Encrypt",
                    "kms:ReEncrypt*",
                    "kms:GenerateDataKey*",
                ],
                principals=[_iam.ServicePrincipal("codebuild.amazonaws.com")],
                resources=["*"],
            )
        )

        # Trigger CodeBuild job
        containerize_build_job = _codebuild.Project(
            self,
            f"opnsrch_ui_cntnr_{env_name}",
            project_name=f"opnsrchuicntnr{env_name}",
            description="Dockerized Opensearch tutorials UI ",
            build_spec=_codebuild.BuildSpec.from_object_to_yaml(build_spec_yml),
            environment=_codebuild.BuildEnvironment(
                build_image=_codebuild.LinuxBuildImage.STANDARD_6_0,
                privileged=True,
                environment_variables={
                    "ecr_repo": _codebuild.BuildEnvironmentVariable(
                        value=full_ecr_repo_name
                    ),
                    "account_id": _codebuild.BuildEnvironmentVariable(
                        value=os.getenv("CDK_DEFAULT_ACCOUNT")
                    ),
                    "region": _codebuild.BuildEnvironmentVariable(
                        value=os.getenv("CDK_DEFAULT_REGION")
                    ),
                    "user_pool_id": _codebuild.BuildEnvironmentVariable(value=pool_id),
                    "client_id": _codebuild.BuildEnvironmentVariable(value=client_id),
                    "rest_endpoint_url": _codebuild.BuildEnvironmentVariable(
                        value=rest_endpoint_url
                    ),
                },
            ),
            encryption_key=encryption_key,
        )

        ecr_policy = _iam.PolicyStatement(
            actions=[
                "ecr:BatchCheckLayerAvailability",
                "ecr:CompleteLayerUpload",
                "ecr:GetAuthorizationToken",
                "ecr:InitiateLayerUpload",
                "ecr:PutImage",
                "ecr:UploadLayerPart",
                "ecr:CreateRepository",
            ],
            resources=["*"],
        )
        containerize_build_job.add_to_role_policy(ecr_policy)
        self.suppressor(
            containerize_build_job,
            "AwsSolutions-IAM5",
            "This role allows apprunner to scan through all images in ECR",
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
