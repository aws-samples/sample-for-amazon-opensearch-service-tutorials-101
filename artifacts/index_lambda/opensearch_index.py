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


def bulk_index_documents(documents):
    """
    Bulk indexes multiple documents into OpenSearch.

    Args:
        documents (list): List of document dictionaries to be indexed

    Returns:
        dict: Response object indicating success or failure
              Success format: {"success": True, "result": "Products indexed successfully", "statusCode": "200"}
              Failure format: {"success": False, "errorMessage": error_message, "statusCode": "500"}
    """
    bulk_data = []
    for doc in documents:
        # Add index action
        bulk_data.append(
            {"index": {"_index": INDEX_NAME, "_id": f"{uuid.uuid4().hex}"}}
        )

        bulk_data.append(doc)
        # Process in batches of 500
        if len(bulk_data) >= 1000:
            response = ops_client.bulk(body=bulk_data)
            if response.get("errors"):
                return failure_response(f"Bulk indexing errors: {response}")
            bulk_data = []

    # Index any remaining documents
    if bulk_data:
        response = ops_client.bulk(body=bulk_data)
        if response.get("errors"):
            return failure_response(f"Bulk indexing errors: {response}")
    return success_response("Products indexed successfully")


def index_products(event):
    """
    Reads products from a JSON file and indexes them into OpenSearch.

    Returns:
        dict: Response object indicating success or failure
              Success format: {"success": True, "result": "Products indexed successfully", "statusCode": "200"}
              Failure format: {"statusCode": "500", "message": error_message}
    """
    LOG.debug(f"method=index_products, event={event}")
    product_list = []
    with open("products_content.jsonl", "r") as json_file:
        product_list = json.load(json_file)
        LOG.debug(f"method=index_products, product_list={product_list}")

    if len(product_list) > 0:
        return bulk_index_documents(product_list)
    else:
        err_msg = "No products to index"
        LOG.error(f"method=index_products, error=" + err_msg)
        return {"statusCode": "500", "message": err_msg}


def delete_index(event):
    """
    Deletes the OpenSearch index specified by INDEX_NAME.

    Returns:
        dict: Response object indicating success or failure
              Success format: {"success": True, "result": "Index deleted successfully", "statusCode": "200"}
              Failure format: {"success": False, "errorMessage": error_message, "statusCode": "500"}

    Raises:
        Exception: If there's an error during index deletion, it's caught and returned as a failure response
    """
    try:
        res = ops_client.indices.delete(index=INDEX_NAME)
        LOG.info(f"method=delete_index, delete_response={res}")
    except Exception as e:
        LOG.error(f"method=delete_index, error={e.info['error']['reason']}")
        return failure_response(f'Error deleting index. {e.info["error"]["reason"]}')
    return success_response("Index deleted successfully")


def handler(event, context):
    if "httpMethod" in event:
        api_map = {
            "POST/index": lambda x: index_products(x),
            "DELETE/index": lambda x: delete_index(x),
        }

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


def failure_response(error_message):
    return {"success": False, "errorMessage": error_message, "statusCode": "500"}


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


# handler({
#   "httpMethod": "POST",
#   "resource": "/search/index-documents"
# }, None)
