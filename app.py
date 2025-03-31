#!/usr/bin/env python3
import os

import aws_cdk as cdk
from aws_cdk import Stack, Tags, Aspects
from cdk_nag import AwsSolutionsChecks
from search_tutorials.apprunner_hosting_stack import AppRunnerHostingStack
from search_tutorials.lambda_layer_stack import LambdaLayerStack
from search_tutorials.opensearch_proxy_stack import OpensearchProxyStack


app = cdk.App()
# Aspects.of(app).add(AwsSolutionsChecks(verbose=True))


def tag_my_stack(stack):
    tags = Tags.of(stack)
    tags.add("project", "aws-search-tutorials-demo")


account_id = os.getenv("CDK_DEFAULT_ACCOUNT")
region = os.getenv("CDK_DEFAULT_REGION")

env = cdk.Environment(account=account_id, region=region)

env_name = app.node.try_get_context("environment_name")

lambda_layer_stack = LambdaLayerStack(app, f"LambdaLayerStack{env_name}", env=env)
opensearch_proxy_stack = OpensearchProxyStack(
    app, f"OpensearchProxy{env_name}", env=env
)
opensearch_proxy_stack.add_dependency(lambda_layer_stack)
apprunner_stack = AppRunnerHostingStack(
    app, f"ApprunnerHostingStack{env_name}", env=env
)
apprunner_stack.add_dependency(opensearch_proxy_stack)

tag_my_stack(opensearch_proxy_stack)
tag_my_stack(lambda_layer_stack)
tag_my_stack(apprunner_stack)

Aspects.of(app).add(AwsSolutionsChecks(verbose=True))

app.synth()
