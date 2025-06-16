from decimal import Decimal
import json
import boto3
import requests
from requests_aws4auth import AWS4Auth
from opensearchpy import OpenSearch, RequestsHttpConnection
from os import getenv
import logging
import uuid
from botocore.exceptions import ClientError

LOG = logging.getLogger()
LOG.setLevel(logging.INFO)
credentials = boto3.Session().get_credentials()

ENDPOINT = getenv("OPENSEARCH_HOST", "default")
SERVICE = "es"  # aoss for Amazon Opensearch serverless
REGION = getenv("AWS_REGION", "us-east-1")
S3_BUCKET_NAME = getenv("S3_BUCKET_NAME")
SEARCH_PIPELINE_NAME = getenv("SEARCH_PIPELINE_NAME", "oss_srch_pipeline")
awsauth = AWS4Auth(
    credentials.access_key,
    credentials.secret_key,
    REGION,
    SERVICE,
    session_token=credentials.token,
)
INDEX_NAME = getenv("INDEX_NAME", "products")
VECTOR_INDEX_NAME_ON_DISK = getenv("VECTOR_INDEX_NAME_ON_DISK", "products_vectorized_on_disk")
VECTOR_INDEX_NAME_IN_MEMORY = getenv("VECTOR_INDEX_NAME_IN_MEMORY", "products_vectorized_in_memory")
MODEL_ID = getenv("MODEL_ID", "cohere.embed-english-v3")
# Initialize S3 client
s3_client = boto3.client('s3', region_name=REGION)
bedrock_client = boto3.client('bedrock-runtime', region_name=REGION)
ops_client = OpenSearch(
    hosts=[{"host": ENDPOINT, "port": 443}],
    http_auth=awsauth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection,
    timeout=300,
)


def get_embedding(text):
    """
    Gets embedding for text using Cohere model via Bedrock.
    
    Args:
        text (str): The text to generate embeddings for
        
    Returns:
        list: The embedding vector
        
    Raises:
        Exception: If there's an error getting the embedding
    """
    try:
        body = json.dumps({
            "texts": [text],
            "input_type": "search_query",
            "truncate": "END",
            "embedding_types": ["float"]
        })
        
        response = bedrock_client.invoke_model(
            modelId=MODEL_ID,
            accept='application/json',
            contentType='application/json',
            body=body
        )
        
        response_body = json.loads(response.get('body').read())
        return response_body['embeddings']['float'][0]
    except Exception as e:
        LOG.error(f"Error getting embedding: {str(e)}")
        raise e


def search_products(event):
    """
    Searches for products in OpenSearch based on different search criteria.

    Args:
        event (dict): The Lambda event object containing the search parameters in the body
                     Expected body format:
                     {
                         "type": str,          # Type of search (multi_match, wildcard_match, match, prefix_match, range_filter, complex_search, vector_search)
                         "attribute_name": str, # Field name to search in, not mandatory for vector_search
                         "attribute_value": str/int, # Value to search for , is required for vector_search too
                         "fields": list,       # Required for multi_match, list of fields with boost values
                         "case_insensitive": bool, # Optional for wildcard_match
                         "minimum_should_match": str/int, # Required for match query
                         "operator": str,      # Required for range_filter (gt, gte, lt, lte)
                         
                         # Complex search parameters
                         "search_value": str,  # Main search term
                         "search_type": str,   # Type of complex search (combined, any, exact)
                         "fields": [           # List of field definitions
                             {
                                 "name": str,  # Field name
                                 "type": str,  # Field type (text, number, select, range)
                                 "boost": int, # Optional boost value
                                 "value": any  # Field value or range object
                             }
                         ]
                     }

    Returns:
        dict: Response object containing search results or error message
              Success format: {"success": True, "result": search_results, "statusCode": "200"}
              Failure format: {"success": False, "errorMessage": error_msg, "statusCode": error_code}
    """
    
    if "body" in event:
        body = json.loads(event["body"])
        is_vector_search = False
        # Handle complex search
        if body["type"] == "complex_search":
            search_value = body.get("search_value", "")
            search_type = body.get("search_type", "combined")
            fields = body.get("fields", [])
            
            # Handle aggregations as a separate search type
            if search_type == "aggregations":
                aggregations = body.get("aggregations", [])
                search_body = {
                    "query": {"match_all": {}},
                    "aggs": {}
                }
                
                # Process each aggregation definition
                for agg in aggregations:
                    agg_type = agg.get("type")
                    agg_field = agg.get("field")
                    agg_name = agg.get("name", agg_field)
                    
                    if not agg_type or not agg_field:
                        continue
                    
                    if agg_type == "terms":
                        search_body["aggs"][agg_name] = {
                            "terms": {
                                "field": agg_field + ".keyword",
                                "size": agg.get("size", 10)
                            }
                        }
                    elif agg_type == "stats":
                        search_body["aggs"][agg_name] = {
                            "stats": {
                                "field": agg_field
                            }
                        }
                    elif agg_type == "range":
                        ranges = agg.get("ranges", [])
                        if ranges:
                            search_body["aggs"][agg_name] = {
                                "range": {
                                    "field": agg_field,
                                    "ranges": ranges
                                }
                            }
                    elif agg_type == "nested_stats":
                        # For nested aggregations like avg_price_by_category
                        search_body["aggs"][agg_name] = {
                            "terms": {
                                "field": agg_field + ".keyword",
                                "size": agg.get("size", 10)
                            },
                            "aggs": {
                                agg.get("metric_name", "value"): {
                                    agg.get("metric_type", "avg"): {
                                        "field": agg.get("metric_field")
                                    }
                                }
                            }
                        }
            
            else:
                # Build bool query for regular searches
                must_conditions = []
                should_conditions = []
                
                # Add text search conditions
                if search_value:
                    text_search = {
                        "multi_match": {
                            "query": search_value,
                            "fields": ["title^3", "description^2", "color"],
                            "type": "best_fields"
                        }
                    }
                    
                    # Add fuzzy search settings if search_type is fuzzy
                    if search_type == "fuzzy":
                        text_search["multi_match"].update({
                            "fuzziness": "AUTO",
                            "prefix_length": 2,
                            "fuzzy_transpositions": True
                        })
                    elif search_type == "exact":
                        text_search["multi_match"]["type"] = "phrase"
                    
                    must_conditions.append(text_search)
                
                # Process each field
                for field in fields:
                    field_name = field.get("name")
                    field_type = field.get("type")
                    field_value = field.get("value")
                    field_boost = field.get("boost")
                    
                    if not field_value:
                        continue
                    
                    # Build field query based on type
                    if field_type == "text":
                        field_query = {
                            "match": {
                                field_name: {
                                    "query": field_value
                                }
                            }
                        }
                        if field_boost:
                            field_query["match"][field_name]["boost"] = field_boost
                    
                    elif field_type == "select":
                        field_query = {"term": {field_name: field_value}}
                    
                    elif field_type == "range":
                        range_query = {"range": {field_name: {}}}
                        if "min" in field_value:
                            range_query["range"][field_name]["gte"] = field_value["min"]
                        if "max" in field_value:
                            range_query["range"][field_name]["lte"] = field_value["max"]
                        field_query = range_query
                    
                    # Add to appropriate conditions list
                    if search_type == "any":
                        should_conditions.append(field_query)
                    else:
                        must_conditions.append(field_query)
                
                # Build final query
                search_body = {
                    "query": {
                        "bool": {
                            "must": must_conditions
                        }
                    }
                }
                
                # Add should conditions for "any" type search
                if search_type == "any" and should_conditions:
                    search_body["query"]["bool"]["should"] = should_conditions
                    search_body["query"]["bool"]["minimum_should_match"] = 1
            
            LOG.debug(f"final Opensearch Query: {search_body}")
            
            response = ops_client.search(index=INDEX_NAME, body=search_body)
            # Add presigned URLs to search results before returning
            try:
                if 'hits' in response:
                    response = add_presigned_urls_to_results(response)
            except Exception as e:
                LOG.error(f"Error adding presigned URLs to search results: {e}")
            return success_response(response)
            
        # Handle existing search types
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
                "size": 100,
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
                "size": 100,
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
                    "size": 100,
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
                    "size": 100,
                    "query": {"match": {attribute_name: {"query": attribute_value}}}
                }
        elif body["type"] == "prefix_match":

            if attribute_value == "":
                search_body = {"size": 100, "query": {"match_all": {}}}
            else:
                search_body = {
                    "size": 100,
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
                "size": 100,
                "query": {
                    "range": {attribute_name: {body["operator"]: int(attribute_value)}}
                }
            }
        
        # Handle vector search
        elif body["type"] == "vector_search":
            try:
                # Get embedding for the search text
                search_text = body["attribute_value"]
                vector_embedding = get_embedding(search_text)
                search_body = {
                    "size": 100,
                    "_source": {
                        "excludes": ["vector_embedding"]
                    },
                    "query": {
                        "knn": {
                            "vector_embedding": {"vector": vector_embedding, "k": 100}
                        }
                    }
                }
            except Exception as e:
                LOG.error(f"Error in vector search: {str(e)}")
                return failure_response(f"Error in vector search: {str(e)}")
                
        elif body["type"] == "hybrid_search":
            search_text = body["attribute_value"]
            vector_embedding = get_embedding(search_text)
            search_body = {
                "size": 100,
                "_source": {
                    "excludes": "vector_embedding"
                },
                "query": {
                    "hybrid": {
                        "queries": [
                            {
                                "multi_match": {
                                    "query": search_text,
                                    "fields": ["title", "description"],
                                    "type": "best_fields"
                                }
                            },
                            {
                                "knn": {
                                    "vector_embedding": {"vector": vector_embedding, "k": 100}
                                }
                            }
                        ]
                    }
                },
                "search_pipeline" : SEARCH_PIPELINE_NAME
            }
            
        else:
            search_body = {"size": 100, "query": {"match_all": {}}}
        
        if body["type"] not in ["vector_search", "hybrid_search"]:
            response = ops_client.search(index=INDEX_NAME, body=search_body)
        else:
            if body["mode"] == "on_disk":
                response = ops_client.search(index=VECTOR_INDEX_NAME_ON_DISK, body=search_body)
            elif body["mode"] == "in_memory":
                response = ops_client.search(index=VECTOR_INDEX_NAME_IN_MEMORY, body=search_body)
            else:
                return failure_response("Invalid request, mode should be on_disk or in_memory")
                
        # Add presigned URLs to search results before returning
        try:
            if 'hits' in response:
                response = add_presigned_urls_to_results(response)
        except Exception as e:
            LOG.error(f"Error adding presigned URLs to search results: {e}")
        return success_response(response)
    return failure_response("Invalid request")


def failure_response(error_message, statusCode="500"):
    return {"success": False, "errorMessage": error_message, "statusCode": statusCode}


def generate_presigned_url(object_key, expiration=3600):
    """
    Generate a presigned URL for an S3 object
    
    :param file_name: Name of the file in S3 bucket
    :param expiration: Time in seconds for the presigned URL to remain valid
    :return: Presigned URL as string or None if error occurs
    """
    try:
        if not S3_BUCKET_NAME:
            LOG.error("S3_BUCKET_NAME environment variable is not set")
            return None
            
        response = s3_client.generate_presigned_url('get_object',
                                                   Params={'Bucket': S3_BUCKET_NAME,
                                                           'Key': object_key},
                                                   ExpiresIn=expiration)
        return response
    except ClientError as e:
        LOG.error(f"Error generating presigned URL for {file_name}: {e}")
        return None

def add_presigned_urls_to_results(search_results):
    """
    Add presigned URLs to search results for each hit that has a file_name
    
    :param search_results: OpenSearch search results
    :return: Modified search results with presigned URLs
    """
    s3_path = f"images/"
    
    if 'hits' in search_results and 'hits' in search_results['hits']:
        for hit in search_results['hits']['hits']:
            if '_source' in hit and 'file_name' in hit['_source']:
                file_name = hit['_source']['file_name']
                object_key = f"{s3_path}{file_name}"
                presigned_url = generate_presigned_url(object_key)
                if presigned_url:
                    hit['_source']['image_url'] = presigned_url
    
    return search_results

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
        except Exception as e:
            LOG.exception(f"error=error_processing_api, api={api_path} , error={e}")
            return respond(failure_response(f"system_exception: {e}"), None)



print(get_embedding("Pink Shoes"))