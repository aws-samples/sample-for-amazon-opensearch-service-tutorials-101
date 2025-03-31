from decimal import Decimal
import json
import boto3
import requests
from requests_aws4auth import AWS4Auth
from opensearchpy import OpenSearch, RequestsHttpConnection
from os import getenv
import logging
import uuid

LOG = logging.getLogger()
LOG.setLevel(logging.INFO)
credentials = boto3.Session().get_credentials()

ENDPOINT = getenv("OPENSEARCH_HOST", "default")
SERVICE = "es"  # aoss for Amazon Opensearch serverless
REGION = getenv("REGION", "us-east-1")
awsauth = AWS4Auth(
    credentials.access_key,
    credentials.secret_key,
    REGION,
    SERVICE,
    session_token=credentials.token,
)
INDEX_NAME = getenv("INDEX_NAME", "products")
ops_client = OpenSearch(
    hosts=[{"host": ENDPOINT, "port": 443}],
    http_auth=awsauth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection,
    timeout=300,
)


def search_products(event):
    """
    Searches for products in OpenSearch based on different search criteria.

    Args:
        event (dict): The Lambda event object containing the search parameters in the body
                     Expected body format:
                     {
                         "type": str,          # Type of search (multi_match, wildcard_match, match, prefix_match, range_filter)
                         "attribute_name": str, # Field name to search in
                         "attribute_value": str/int, # Value to search for
                         "fields": list,       # Required for multi_match, list of fields with boost values
                         "case_insensitive": bool, # Optional for wildcard_match
                         "minimum_should_match": str/int, # Required for match query
                         "operator": str       # Required for range_filter (gt, gte, lt, lte)
                     }

    Returns:
        dict: Response object containing search results or error message
              Success format: {"success": True, "result": search_results, "statusCode": "200"}
              Failure format: {"success": False, "errorMessage": error_msg, "statusCode": error_code}
    """

    if "body" in event:
        body = json.loads(event["body"])
        attribute_name = body["attribute_name"] if "attribute_name" in body else None
        attribute_value = body["attribute_value"] if "attribute_value" in body else None
        if not isinstance(attribute_name, str):
            return failure_response(
                "Invalid request, attribute_name should be of type string", "400"
            )
        if not (isinstance(attribute_value, str) or isinstance(attribute_value, int)):
            return failure_response(
                "Invalid request, attribute_value should be of type string or integer",
                "400",
            )

        multi_match_fields = []
        search_body = {}
        if body["type"] == "multi_match":
            fields = body["fields"]
            for field in fields:
                if not isinstance(field.get("field"), str):
                    return failure_response(
                        "Invalid request, field should be of type string", "400"
                    )
                if not isinstance(field.get("boost"), int):
                    return failure_response(
                        "Invalid request, boost should be of type integer", "400"
                    )

                multi_match_fields.append(f'{field["field"]}^{field["boost"]}')
            # perform multi-match query
            search_body = {
                "query": {
                    "multi_match": {
                        "query": attribute_value,
                        "fields": multi_match_fields,
                        "type": "phrase_prefix",
                    }
                }
            }
        # write an else if condition for a wildcard search
        elif body["type"] == "wildcard_match":
            case_insensitive = False
            if "case_insensitive" in body:
                case_insensitive = bool(body["case_insensitive"])
            search_body = {
                "query": {
                    "wildcard": {
                        attribute_name: {
                            "value": attribute_value,
                            "case_insensitive": case_insensitive,
                        }
                    }
                }
            }
        elif body["type"] == "match":
            if "minimum_should_match" in body["minimum_should_match"]:
                if not (
                    isinstance(body["minimum_should_match"], int)
                    or isinstance(body["minimum_should_match"], str)
                ):
                    return failure_response(
                        "Invalid request, minimum_should_match should be of type string or integer",
                        "400",
                    )
                search_body = {
                    "query": {
                        "match": {
                            attribute_name: {
                                "query": attribute_value,
                                "minimum_should_match": body["minimum_should_match"],
                            }
                        }
                    }
                }
            else:
                search_body = {
                    "query": {"match": {attribute_name: {"query": attribute_value}}}
                }
        elif body["type"] == "prefix_match":

            if attribute_value == "":
                search_body = {"query": {"match_all": {}}}
            else:
                search_body = {
                    "query": {
                        "match_phrase_prefix": {
                            attribute_name: {
                                "query": attribute_value,
                                "max_expansions": 10,
                                "slop": 1,
                            }
                        }
                    }
                }
        elif body["type"] == "range_filter":
            if not isinstance(body["operator"], str):
                return failure_response(
                    "Invalid request, operator should be of type string", "400"
                )
            search_body = {
                "query": {
                    "range": {attribute_name: {body["operator"]: int(attribute_value)}}
                }
            }
        else:
            search_body = {"query": {"match_all": {}}}

        response = ops_client.search(index=INDEX_NAME, body=search_body)
        return success_response(response)
    return failure_response("Invalid request")


def failure_response(error_message, statusCode="500"):
    return {"success": False, "errorMessage": error_message, "statusCode": statusCode}


def success_response(result):
    return {"success": True, "result": result, "statusCode": "200"}


class CustomJsonEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            if float(obj).is_integer():
                return int(float(obj))
            else:
                return float(obj)
        return super(CustomJsonEncoder, self).default(obj)


# JSON REST output builder method
def respond(err, res=None):
    return {
        "statusCode": "400" if err else res["statusCode"],
        "body": json.dumps(err) if err else json.dumps(res, cls=CustomJsonEncoder),
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Credentials": "*",
        },
    }


# write a hello world lambda function
def handler(event, context):
    LOG.debug(
        f"method=handler, event={event}, message=Opensearch Tutorial starting point"
    )
    if "httpMethod" in event:
        api_map = {"POST/search": lambda x: search_products(x)}
        http_method = event["httpMethod"] if "httpMethod" in event else ""
        api_path = http_method + event["resource"]
        try:
            if api_path in api_map:
                LOG.info(f"method=handler , api_path={api_path}")
                return respond(None, api_map[api_path](event))
            else:
                LOG.info(f"error=api_not_found , api={api_path}")
                return respond(failure_response("api_not_supported"), None)
        except Exception:
            LOG.exception(f"error=error_processing_api, api={api_path}")
            return respond(failure_response("system_exception"), None)
