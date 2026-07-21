from aws_cdk import (
    NestedStack,
    aws_cognito as _cognito,
    aws_codebuild as _codebuild,
    aws_iam as _iam,
    aws_kms as _kms,
    aws_s3 as _s3,
    aws_cloudfront as _cloudfront,
    aws_cloudfront_origins as _origins,
)

from constructs import Construct
import os
import yaml
import aws_cdk as _cdk
import cdk_nag as _cdk_nag


# This stack hosts the UI on S3 + CloudFront.
# A CodeBuild job builds the React app (injecting Cognito/API config), syncs the
# static assets to the S3 origin bucket and invalidates the CloudFront cache.
class CloudFrontUIStack(NestedStack):

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
        env_name = self.node.try_get_context("environment_name")

        account_id = os.getenv("CDK_DEFAULT_ACCOUNT")
        region = os.getenv("CDK_DEFAULT_REGION")

        # Private S3 bucket that serves as the CloudFront origin for the UI
        site_bucket = _s3.Bucket(
            self,
            f"opnsrch-ui-bucket-{env_name}",
            block_public_access=_s3.BlockPublicAccess.BLOCK_ALL,
            encryption=_s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            removal_policy=_cdk.RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # CloudFront distribution fronting the S3 origin with Origin Access Control
        distribution = _cloudfront.Distribution(
            self,
            f"opnsrch-ui-distribution-{env_name}",
            comment=f"opensearch-tutorials-ui-{env_name}",
            default_behavior=_cloudfront.BehaviorOptions(
                origin=_origins.S3BucketOrigin.with_origin_access_control(site_bucket),
                viewer_protocol_policy=_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=_cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            default_root_object="index.html",
            error_responses=[
                _cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
                _cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
            ],
        )

        build_spec_yml = ""
        with open("buildspec_build_ui.yml", "r") as stream:
            try:
                build_spec_yml = yaml.safe_load(stream)
            except yaml.YAMLError as exc:
                print(exc)

        encryption_key = _kms.Key(
            self,
            "CodeBuildEncryptionKey",
            enable_key_rotation=True,
            alias=f"alias/cb-ui-encryptn-{env_name}-ky",
            description="KMS key for CodeBuild artifacts encryption",
        )

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

        # CodeBuild job builds the UI and publishes it to S3 + CloudFront
        ui_build_job = _codebuild.Project(
            self,
            f"opnsrch_ui_cntnr_{env_name}",
            project_name=f"opnsrchuicntnr{env_name}",
            source=_codebuild.Source.s3(
                bucket=_s3.Bucket.from_bucket_name(
                    self,
                    f"codebuild-{env_name}-{region}-{account_id}-input-bucket",
                    f"codebuild-{env_name}-{region}-{account_id}-input-bucket",
                ),
                path="sample-for-amazon-opensearch-tutorials-101.zip",
            ),
            description="Builds the Opensearch tutorials UI and deploys to S3 + CloudFront",
            build_spec=_codebuild.BuildSpec.from_object_to_yaml(build_spec_yml),
            environment=_codebuild.BuildEnvironment(
                build_image=_codebuild.LinuxBuildImage.STANDARD_6_0,
                environment_variables={
                    "region": _codebuild.BuildEnvironmentVariable(value=region),
                    "user_pool_id": _codebuild.BuildEnvironmentVariable(value=pool_id),
                    "client_id": _codebuild.BuildEnvironmentVariable(value=client_id),
                    "rest_endpoint_url": _codebuild.BuildEnvironmentVariable(
                        value=rest_endpoint_url
                    ),
                    "site_bucket": _codebuild.BuildEnvironmentVariable(
                        value=site_bucket.bucket_name
                    ),
                    "distribution_id": _codebuild.BuildEnvironmentVariable(
                        value=distribution.distribution_id
                    ),
                },
            ),
            encryption_key=encryption_key,
        )

        # Allow CodeBuild to publish the built assets and refresh the CDN cache
        site_bucket.grant_read_write(ui_build_job)
        ui_build_job.add_to_role_policy(
            _iam.PolicyStatement(
                actions=["cloudfront:CreateInvalidation", "cloudfront:GetDistribution"],
                resources=[
                    f"arn:aws:cloudfront::{account_id}:distribution/{distribution.distribution_id}"
                ],
            )
        )

        _cdk.CfnOutput(
            self,
            f"opnsrch-ui-url-{env_name}",
            value=f"https://{distribution.distribution_domain_name}",
            description="CloudFront UI URL",
        )

        _cdk_nag.NagSuppressions.add_stack_suppressions(
            self,
            [
                _cdk_nag.NagPackSuppression(
                    id="AwsSolutions-CFR1",
                    reason="Geo restriction not needed for this Opensearch 101 sample UI",
                ),
                _cdk_nag.NagPackSuppression(
                    id="AwsSolutions-CFR2",
                    reason="WAF not needed for this Opensearch 101 sample UI",
                ),
                _cdk_nag.NagPackSuppression(
                    id="AwsSolutions-CFR3",
                    reason="CloudFront access logging deferred for this Opensearch 101 sample",
                ),
                _cdk_nag.NagPackSuppression(
                    id="AwsSolutions-CFR4",
                    reason="Using the default CloudFront certificate for this Opensearch 101 sample",
                ),
                _cdk_nag.NagPackSuppression(
                    id="AwsSolutions-S1",
                    reason="Server access logs not needed for this Opensearch 101 sample UI bucket",
                ),
                _cdk_nag.NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="CodeBuild needs object-level access to sync the UI bucket and invalidate the distribution",
                ),
            ],
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
