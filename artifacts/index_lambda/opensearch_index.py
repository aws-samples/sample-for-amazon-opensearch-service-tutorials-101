from decimal import Decimal
import json
import boto3
import requests
from requests_aws4auth import AWS4Auth
from opensearchpy import OpenSearch, RequestsHttpConnection
from os import getenv
import logging
import uuid
from datetime import datetime, timedelta

LOG = logging.getLogger()
LOG.setLevel(logging.INFO)
credentials = boto3.Session().get_credentials()
print(boto3.__version__)
ENDPOINT = getenv("OPENSEARCH_HOST", "default")
SERVICE = "es"  # aoss for Amazon Opensearch serverless
REGION = getenv("AWS_REGION", "us-east-1")
S3_BUCKET = getenv("S3_BUCKET_NAME", "default")
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

ops_client = OpenSearch(
    hosts=[{"host": ENDPOINT, "port": 443}],
    http_auth=awsauth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection,
    timeout=300,
)

s3_client = boto3.client('s3')
bedrock_client = boto3.client('bedrock-runtime', region_name=REGION, endpoint_url=f"https://bedrock-runtime.{REGION}.amazonaws.com")

def generate_presigned_url(event):
    """
    Generates a presigned URL for uploading a file to S3.
    
    Args:
        event (dict): Event object containing filename and content_type
        
    Returns:
        dict: Response object containing the presigned URL and the S3 key
    """
    try:
        body = json.loads(event.get('body', '{}'))
        filename = body.get('filename')
        content_type = body.get('contentType')
        
        if not filename or not content_type:
            return failure_response("Filename and content type are required")
            
        # Generate a unique key for the file
        key = f"images/{uuid.uuid4()}_{filename}"
        
        # Generate presigned URL
        result = s3_client.generate_presigned_post(Bucket=S3_BUCKET, Key=key)
        
        
        return success_response(result)
    except Exception as e:
        LOG.error(f"Error generating presigned URL: {str(e)}")
        return failure_response(f"Error generating presigned URL: {str(e)}")

# create the index if it doesn't exist
def create_index():
    """
    Creates the OpenSearch index if it doesn't exist.
    """
    try:
        res = ops_client.indices.create(index=INDEX_NAME, body={
            "mappings": {
                "properties": {
                    "category": {
                        "type": "text",
                        "analyzer": "stop",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "color": {
                        "type": "text",
                        "analyzer": "stop",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "title": {
                        "type": "text",
                        "analyzer": "stop",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "description": {
                        "type": "text",
                        "analyzer": "stop",
                    },
                    "price": {"type": "float"},
                    "file_name": {"type": "text"}
                }
            }
        })
        LOG.info(f"method=create_index, create_response={res}")
    except Exception as e:
        LOG.error(f"method=create_index, error={e.info['error']['reason']}")
        return failure_response(f'Error creating index. {e.info["error"]["reason"]}')
    return success_response("Index created successfully")

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
    create_index()
    
    bulk_data = []
    for doc in documents:
        # Add index action
        bulk_data.append(
            {"index": {"_index": INDEX_NAME, "_id": f"{uuid.uuid4().hex}"}}
        )
        #remove vector_embedding from doc before indexing
        if 'vector_embedding' in doc:
            del doc['vector_embedding']
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


def index_custom_document(event):
    """
    Indexes a single custom document into OpenSearch.
    
    Args:
        event (dict): Event object containing the document to index
        
    Returns:
        dict: Response object indicating success or failure
    """
    try:
        body = json.loads(event.get('body', '[]'))
        if not isinstance(body, list):
            body = [body]
        return bulk_index_documents(body)
    except Exception as e:
        LOG.error(f"Error indexing custom document: {str(e)}")
        return failure_response(f"Error indexing custom document: {str(e)}")


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


def search_nlp():
    try:
        post_processor_search_pipleline = {
            "description": "Post processor for hybrid search",
            "phase_results_processors": [ {
                "normalization-processor": {
                    "normalization": {
                        "technique": "min_max"
                    },
                        "combination": {
                            "technique": "arithmetic_mean",
                            "parameters": {
                                "weights": [0.3,0.7]
                            }
                        }
                    }
                }
            ]
        }
        headers = {'Content-Type': 'application/json'}
        response = requests.put(f"https://{ENDPOINT}/_search/pipeline/{SEARCH_PIPELINE_NAME}", auth=awsauth, json=post_processor_search_pipleline,
                     headers=headers, verify=False)
        LOG.info(f"method=search_nlp, message={SEARCH_PIPELINE_NAME} created, response={response.text}")
        return success_response(f"Post processor search pipeline {SEARCH_PIPELINE_NAME} created successfully")
    except Exception as e:
        LOG.error(f"method=search_nlp, error={e}")
        return failure_response(f'Error creating post processor search pipeline. {e}')

def create_vector_index_on_disk_mode():
    """
    Creates the OpenSearch index for vectorized products if it doesn't exist.
    """
    try:
        res = ops_client.indices.create(index=VECTOR_INDEX_NAME_ON_DISK, body={
            "settings": {
                "index": {
                    "knn": True,
                    "knn.algo_param.ef_search": 100
                }
            },
            "mappings": {
                "properties": {
                    "category": {
                        "type": "text",
                        "analyzer": "stop",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "color": {
                        "type": "text",
                        "analyzer": "stop",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "title": {
                        "type": "text",
                        "analyzer": "stop",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "description": {
                        "type": "text",
                        "analyzer": "stop",
                    },
                    "price": {"type": "float"},
                    "file_name": {"type": "text"},
                    "vector_embedding": {
                        "type": "knn_vector",
                        "dimension": 1024,
                        "data_type": "float",
                        "mode": "on_disk",
                        "compression_level": "32x", # default is 32x
                        "method": {
                            "name":"hnsw",
                            "engine":"faiss",
                            "space_type": "innerproduct",
                            "parameters": {
                                "ef_construction": 128,
                                "m": 24
                          }
                        }
                    }
                }
            }
        })
        LOG.info(f"method=create_vector_index, create_response={res}")
    except Exception as e:
        LOG.error(f"method=create_vector_index_on_disk_mode, error={e.info['error']['reason']}")
        return failure_response(f'Error creating vector index with on-disk mode. {e.info["error"]["reason"]}')
    return success_response("Vector index created successfully with on-disk mode")


def create_vector_index_in_memory_mode():
    """
    Creates the OpenSearch index for vectorized products if it doesn't exist.
    """
    try:
        res = ops_client.indices.create(index=VECTOR_INDEX_NAME_IN_MEMORY, body={
            "settings": {
                "index": {
                    "knn": True,
                    "knn.algo_param.ef_search": 100
                }
            },
            "mappings": {
                "properties": {
                    "category": {
                        "type": "text",
                        "analyzer": "stop",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "color": {
                        "type": "text",
                        "analyzer": "stop",
                        "fields": {   
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "title": {
                        "type": "text",
                        "analyzer": "stop",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "description": {
                        "type": "text",
                        "analyzer": "stop",
                    },
                    "price": {"type": "float"},
                    "file_name": {"type": "text"},
                    "vector_embedding": {
                        "type": "knn_vector",
                        "dimension": 1024,
                        "method": {
                            "name":"hnsw",
                            "engine":"faiss",
                            "space_type": "innerproduct",
                            "parameters": {
                                "ef_construction": 128,
                                "m": 24
                          }
                        }
                    }
                }
            }
        })
        LOG.info(f"method=create_vector_index_in_memory_mode, create_response={res}")
    except Exception as e:
        LOG.error(f"method=create_vector_index_in_memory_mode, error={e.info['error']['reason']}")
        return failure_response(f'Error creating vector index with in-memory mode. {e.info["error"]["reason"]}')
    return success_response("Vector index created successfully with in-memory mode")


def get_embedding(text):
    """
    Gets embedding for text using Cohere model via Bedrock.
    """
    try:
        body = json.dumps({
            "texts": [text],
            "input_type": "search_document",
            "truncate": "END",
            "embedding_types": ["float"]
        })
        LOG.info(f"method=get_embedding, body={body}")
        response = bedrock_client.invoke_model(
            modelId=MODEL_ID,
            accept='application/json',
            contentType='application/json',
            body=body
        )
        LOG.info(f"method=get_embedding, response={response}")
        response_body = json.loads(response.get('body').read())
        return response_body['embeddings']['float'][0]
    except Exception as e:
        LOG.error(f"Error getting embedding: {str(e)}")
        raise e

def vectorize_and_index_products(event):
    """
    Vectorizes products using Bedrock embeddings and indexes them into OpenSearch.
    """
    try:
        # Read products from file
        product_list = []
        with open("products_content.jsonl", "r") as json_file:
            product_list = json.load(json_file)
        
        if not product_list:
            return failure_response("No products to index")
        
        LOG.info("method=vectorize_and_index_products, creating search pipeline")
        res=search_nlp()
        if not res['success']:
            return failure_response(res['errorMessage'])
        
        # Create vector index with on-disk and in-memory modes
        LOG.info("method=vectorize_and_index_products, creating vector index with on-disk")
        res=create_vector_index_on_disk_mode()
        if not res['success'] and "already exists" not in res['errorMessage']:
            return failure_response(res['errorMessage'])

        LOG.info("method=vectorize_and_index_products, creating vector index with in-memory")
        res=create_vector_index_in_memory_mode()
        if not res['success'] and "already exists" not in res['errorMessage']:
            return failure_response(res['errorMessage'])

        LOG.info("method=vectorize_and_index_products, vectorizing and indexing products")
    

        # Process products in batches
        batch_size = 20  # Smaller batch size due to embedding API calls
        for i in range(0, len(product_list), batch_size):
            batch = product_list[i:i + batch_size]
            bulk_data_on_disk = []
            bulk_data_in_memory = []
            
            for product in batch:
                if MODEL_ID != 'cohere.embed-english-v3':
                    # Combine relevant fields
                    combined_text = f"{product.get('title', '')}, Category: {product.get('category', '')}, Description: {product.get('description', '')}"
                
                    LOG.info(f"method=vectorize_and_index_products, combined_text={combined_text}")
                    # Get embedding
                    vector_embedding = get_embedding(combined_text)
                    LOG.info(f"method=vectorize_and_index_products, vector_embedding={len(vector_embedding)}")
                    # Add vector field to product
                    # product['combined_text'] = combined_text
                    product['vector_embedding'] = vector_embedding
                
                # else the vector_embeddings using cohere are already generated and are present in the json file
                # no need to regenerate

                # Add to bulk data
                bulk_data_on_disk.append({
                    "index": {
                        "_index": VECTOR_INDEX_NAME_ON_DISK,
                        "_id": f"{uuid.uuid4().hex}"
                    }
                })
                bulk_data_on_disk.append(product)

                bulk_data_in_memory.append({
                    "index": {
                        "_index": VECTOR_INDEX_NAME_IN_MEMORY,
                        "_id": f"{uuid.uuid4().hex}"
                    }
                })
                bulk_data_in_memory.append(product)

            # Index batch
            if bulk_data_on_disk:
                LOG.info(f"method=vectorize_and_index_products, bulk_data_on_disk={len(bulk_data_on_disk)}")
                response = ops_client.bulk(body=bulk_data_on_disk)
                if response.get("errors"):
                    return failure_response(f"Bulk indexing errors: {response}")
            if bulk_data_in_memory:
                LOG.info(f"method=vectorize_and_index_products, bulk_data_in_memory={len(bulk_data_in_memory)}")
                response = ops_client.bulk(body=bulk_data_in_memory)
                if response.get("errors"):
                    return failure_response(f"Bulk indexing errors: {response}")
        
        return success_response("Products vectorized and indexed successfully")
        
    except Exception as e:
        LOG.error(f"Error in vectorize_and_index_products: {str(e)}")
        return failure_response(f"Error vectorizing and indexing products: {str(e)}")

def delete_vector_index(event):
    """
    Deletes both vector indices.
    """
    try:
        # Delete on-disk index
        ops_client.indices.delete(index=VECTOR_INDEX_NAME_ON_DISK)
        # Delete in-memory index
        ops_client.indices.delete(index=VECTOR_INDEX_NAME_IN_MEMORY)
        return success_response("Vector indices deleted successfully")
    except Exception as e:
        LOG.error(f"Error deleting vector indices: {str(e)}")
        return failure_response(f"Error deleting vector indices: {str(e)}")

def handler(event, context):
    if "httpMethod" in event:
        api_map = {
            "POST/index": lambda x: index_products(x),
            "POST/index-custom-document": lambda x: index_custom_document(x),
            "DELETE/index": lambda x: delete_index(x),
            "POST/presigned-url": lambda x: generate_presigned_url(x),
            "POST/vectorize-index": lambda x: vectorize_and_index_products(x),
            "DELETE/vectorize-index": lambda x: delete_vector_index(x),
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


# Test case for get_embedding
# resp = get_embedding("Sleek Grey and Blue Womens Running Shoes, Category: women, Description: Experience ultimate comfort and performance with our stylish grey and blue running shoe. Designed with breathable mesh and advanced cushioning technology, these shoes will keep your feet cool and supported during your longest runs. The vibrant blue accents add a touch of flair to your workout attire.")
# print(resp)
# print(len(resp))

# handler({
#   "httpMethod": "POST",
#   "resource": "/search/index-documents"
# }, None)
