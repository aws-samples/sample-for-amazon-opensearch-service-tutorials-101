import { useState, useEffect, useContext } from "react";
import { withAuthenticator } from '@aws-amplify/ui-react';
import * as React from "react";
import {
  Container,
  ContentLayout,
  Header,
  Button,
  SpaceBetween,
  FormField,
  Input,
  Cards,
  Box,
  Grid,
  Alert,
  ExpandableSection,
  HelpPanel,
  Icon
} from "@cloudscape-design/components";

import { AuthHelper } from "../common/helpers/auth-help";
import { AppPage } from "../common/types";
import config from "../config.json";
import { AppContext } from "../common/context";

function VectorSearchPage(props: AppPage) {
  const appData = useContext(AppContext);
  const [searchValue, setSearchValue] = useState("");
  const [items, setItems] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState<"error" | "success" | "warning" | "info">("error");
  const [onDiskItems, setOnDiskItems] = useState([]);
  const [inMemoryItems, setInMemoryItems] = useState([]);
  const [onDiskHits, setTotalOnDiskHits] = useState([])
  const [inMemoryHits, setTotalInMemoryHits] = useState([])
  const [isLoading, setIsLoading] = useState(false);
  const [onDiskTime, setOnDiskTime] = useState(0);
  const [inMemoryTime, setInMemoryTime] = useState(0);

  const SafeHtml = ({ html }: { html: string }) => {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  useEffect(() => {
    const init = async () => {
      let userdata = await AuthHelper.getUserDetails();
      props.setAppData({
        userinfo: userdata
      });
    };
    init();
  }, []);

  function highlighter(text: string, search_value: string) {
    if (!search_value || !text) {
      return text;
    }

    const lowerText = text.toLowerCase();
    const lowerSearch = search_value.toLowerCase();

    if (!lowerText.includes(lowerSearch)) {
      return text;
    }

    let result = '';
    let lastIndex = 0;
    let currentIndex = 0;

    while ((currentIndex = lowerText.indexOf(lowerSearch, lastIndex)) !== -1) {
      result += text.slice(lastIndex, currentIndex);
      result += `<b>${text.slice(currentIndex, currentIndex + search_value.length)}</b>`;
      lastIndex = currentIndex + search_value.length;
    }

    result += text.slice(lastIndex);
    return result;
  }

  const handle_notifications = (message: string, notify_type: "error" | "success" | "warning" | "info") => {
    setAlertMsg(message);
    setAlertType(notify_type);
    setShowAlert(true);
  };

  async function performVectorSearch() {
    if (searchValue.length < 2) {
      handle_notifications("Search term must be at least 2 characters long", "warning");
      return;
    }

    setIsLoading(true);
    setOnDiskItems([]);
    setInMemoryItems([]);

    const token = appData.userinfo.tokens.idToken.toString();

    const disk_queryBody = {
      type: "vector_search",
      attribute_value: searchValue,
      attribute_name: "vector_embedding", // this fieldname is unused, we by default search on vector_embedding field
      mode: "on_disk" 
    };
    const in_memory_queryBody = {
      type: "vector_search",
      attribute_value: searchValue,
      attribute_name: "vector_embedding", // this fieldname is unused, we by default search on vector_embedding field
      mode: "in_memory" 
    };

    try {
      // Make parallel requests for both modes
      const onDiskPromise = fetch(config["apiUrl"] + "/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        },
        body: JSON.stringify(disk_queryBody)
      }).then(async response => {
        if (response.ok) {
          const resp = await response.json();
          const arr = resp['result']['hits']['hits'];
          setOnDiskTime(resp["result"]["took"]);
          setTotalOnDiskHits(resp["result"]["hits"]["total"]["value"])
          const itms = arr.map((hit: any) => {
            const source = hit['_source'];
            return {
              name: highlighter(source['title'], searchValue),
              title: source['title'],
              description: highlighter(source['description'], searchValue),
              color: highlighter(source['color'], searchValue),
              price: "$" + highlighter(String(source['price']), String(searchValue)),
              image_url: source['image_url']
            };
          });
          setOnDiskItems(itms);
        } else {
          const error_resp = await response.json();
          handle_notifications("Error performing search: " + error_resp["errorMessage"], "error");
        }
      });

      const inMemoryPromise = fetch(config["apiUrl"] + "/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        },
        body: JSON.stringify(in_memory_queryBody)
      }).then(async response => {
        if (response.ok) {
          const resp = await response.json();
          const arr = resp['result']['hits']['hits'];
          setInMemoryTime(resp["result"]["took"]);
          setTotalInMemoryHits(resp["result"]["hits"]["total"]["value"])
          const itms = arr.map((hit: any) => {
            const source = hit['_source'];
            return {
              name: highlighter(source['title'], searchValue),
              title: source['title'],
              description: highlighter(source['description'], searchValue),
              color: highlighter(source['color'], searchValue),
              price: "$" + highlighter(String(source['price']), String(searchValue)),
              image_url: source['image_url']
            };
          });
          setInMemoryItems(itms);
        } else {
          const error_resp = await response.json();
          handle_notifications("Error performing search: " + error_resp["errorMessage"], "error");
        }
      });

    //   // Wait for both promises to complete to handle any errors
    //   await Promise.all([onDiskPromise, inMemoryPromise]);
      
    //   // Check if both requests failed
    //   if (onDiskItems.length === 0 && inMemoryItems.length === 0) {
    //     handle_notifications("Vector Index not found, please index the product catalog first", "error");
    //   }
    } catch (error) {
      handle_notifications("Error performing search: " + error, "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ContentLayout
      defaultPadding
      headerVariant="high-contrast"
      header={
        <Header
          variant="h1"
          description="Search for semantically similar products"
          actions={<Button iconName="settings" variant="icon" />}>
          Semantic Search
        </Header>
      }
    >
      <Container fitHeight>
        {showAlert && (
          <Alert
            dismissible
            statusIconAriaLabel={alertType}
            type={alertType}
            onDismiss={() => setShowAlert(false)}
          >
            {alertMsg}
          </Alert>
        )}

        <ExpandableSection headerText="Guide to Semantic Search">
          <HelpPanel
            footer={
              <div>
                <h3>
                  Learn more{" "}
                  <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li>
                    <a href="https://docs.opensearch.org/docs/latest/vector-search/ai-search/semantic-search/">Semantic Search Documentation</a>
                  </li>
                  <li>
                  <a href="https://docs.opensearch.org/docs/latest/vector-search/optimizing-storage/disk-based-vector-search/">On-Disk Mode Documentation</a>
                  </li>
                  <li>
                  <a href="https://opensearch.org/blog/reduce-cost-with-disk-based-vector-search/">On-Disk Mode Blog-1</a>
                  </li>
                  <li><a href="https://aws.amazon.com/blogs/big-data/opensearch-vector-engine-is-now-disk-optimized-for-low-cost-accurate-vector-search/">On-Disk Mode Blog-2</a></li>
                </ul>
              </div>
            }
          >
            <div>
              <p>
                <b>Semantic search</b> leverages embedding models to understand the context and intent of queries, going beyond simple keyword matching. It works by converting text into dense vectors (lists of floating-point numbers) that capture semantic meaning.
                The user query is converted into a vector using an embedding model (Cohere embed-english-v3) on Amazon Bedrock and searched against the vector index.

                In our example we compare the performance of two modes of searching the vector index.
                <ul>
                  <li><b>On-Disk Mode</b> is used to search the vector index on the disk. It is slower than <b>In-Memory Mode</b> because it works in two phases. First it searches the compressed in-memory index for candidates. Then it retrieves full-precision vectors from disk to re-score results.</li>
                  <li><b>In-Memory Mode</b> is used to search the vector index in memory. It is faster than <b>On-Disk Mode</b> as the KNN graph resides in memory.</li>
                </ul>

                <b>On-Disk Mode</b> is a relatively new feature in Opensearch released in version 2.17. The on-disk memory mode in OpenSearch provides a memory-efficient approach for vector search operations, making vector search accessible in low-memory environments.
                
                <h4>Benefits of On-Disk Memory Mode</h4>
                <ul>
                  <li><b>Cost Reduction</b>: Reduces operational costs by up to 67-83% compared to memory mode</li>
                  <li><b>Memory Efficiency</b>: Decreases memory requirements by 97% through vector compression</li>
                  <li><b>High Quality</b>: Maintains strong recall (typically 93-99%) despite compression</li>
                  <li><b>Reasonable Latency</b>: Performs searches in low hundreds of milliseconds (P90 ≈ 100-200ms)</li>
                  <li>Scalability: Makes working with billions of vectors economically viable</li>
                </ul>
                <b> How it works </b>
                <ol>
                  <li>Vector Compression: Converts 32-bit full-precision vectors to binary vectors (1-bit per dimension) store in memory and full vectors are stored on disk</li>
                  <li>Two-Phase Search: First searches the compressed in-memory index for candidates. Then retrieves full-precision vectors from disk to re-score results.</li>
                  <li>Default Compression: 32x compression (97% smaller than full-precision)</li>
                </ol>
              </p>
              <p>
                <b>In our example</b>, let's search for "Dark footwear for gents and compare the performance of On-Disk Mode and In-Memory Mode"
              </p>
             

              <h4>Prerequisites</h4>
              <ul>
                <li>Access to Cohere embed English v3 model on Amazon Bedrock</li>
                <li><a href="#/semantic-search/vector-index">Index your documents</a> into the vector index first</li>
              </ul>
              <p>
                <b>In our example</b>, let's search for "Pink shoes for women under 12000"
              </p>
              <pre>
                  {JSON.stringify({
                    "query": {
                        "knn": {
                            "field": "vector_embedding",
                            "vector": ["0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0 ..."],
                            "k": 10,
                        }
                    }
                  }, null, 2)}
              </pre>
              <h4>Key Parameters</h4>
              <ul>
                <li><b>k</b>: Number of nearest neighbors to return (recommend starting with 100)</li>
              </ul>
              <h4>Best Practices</h4>
              <ul>
                <li>Use text chunking for longer documents</li>
                <li>Enable k-NN on the indexwith "index.knn": true in the index settings</li>
                <li>Choose the appropriate engine (e.g., "lucene", "faiss", "hnsw")</li>
                <li>Choose the appropriate distance metric (e.g., "cosine", "euclidean", "l2", "inner_product")</li>
                <li>Exclude embedding fields from search responses using _source.excludes for better performance</li>
                <li>Optimize k value in neural queries based on your use case (default k=100)</li>
                <li>Consider combining with keyword search for hybrid approaches</li>
                <li>Use the explain feature for debugging and optimization</li>
              </ul>
            </div>
          </HelpPanel>
        </ExpandableSection>

        <div style={{ height: "2vh" }} />

        <SpaceBetween size="l">
          <FormField label="Search Term">
            <Input
              value={searchValue}
              onChange={({ detail }) => setSearchValue(detail.value)}
              placeholder="Enter search term ..."
            />
          </FormField>

          <Button variant="primary" onClick={performVectorSearch}>
            Search
          </Button>

          <Grid gridDefinition={[ { colspan: 5 }, { colspan: 1 }, { colspan: 6 }]}>
            <div>
            {onDiskTime > 0 && <Header variant="h3">On-Disk Mode ({onDiskTime}ms) ({onDiskHits} items)</Header>}
              {onDiskTime === 0 && <Header variant="h3">On-Disk Mode</Header>}
              <Cards
                cardDefinition={{
                  header: item => <SafeHtml html={item.name} />,
                  sections: [
                    {
                      id: "description",
                      header: "Description",
                      content: item => (
                        <div 
                          style={{ 
                            marginTop: '20px', 
                            marginBottom: '10px',
                            fontFamily: "'Tangerine', 'Brush Script MT', cursive",
                            fontSize: '1.5rem',
                            lineHeight: '1.6',
                            color: '#333',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                            padding: '10px',
                            background: 'linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0.7))',
                            borderRadius: '8px',
                            maxHeight: '200px',
                            overflow: 'auto'
                          }}
                        >
                          <SafeHtml html={item.description} />
                        </div>
                        )
                    },
                    {
                      id: "color",
                      header: "Color",
                      content: item => <SafeHtml html={item.color} />
                    },
                    {
                      id: "price",
                      header: "Price",
                      content: item => <SafeHtml html={item.price} />
                    },
                    {
                      id: "image",
                      header: "Image",
                      content: item => (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          style={{ maxWidth: "100%", height: "auto" }}
                        />
                      )
                    }
                  ]
                }}
                cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }]}
                items={onDiskItems}
                loadingText="Loading on-disk results..."
                trackBy="title"
                empty={
                  <Box textAlign="center" color="inherit">
                    <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                      {isLoading ? "Loading..." : "No results found."}
                    </Box>
                  </Box>
                }
              />
            </div>
          
            <div style={{ width: "2px", height: "100%", backgroundColor: "#ccc" }} />
          
            <div>
              {inMemoryTime > 0 && <Header variant="h3">In-Memory Mode ({inMemoryTime}ms) ({inMemoryHits} items)</Header>}
              {inMemoryTime === 0 && <Header variant="h3">In-Memory Mode</Header>}
              <Cards
                cardDefinition={{
                  header: item => <SafeHtml html={item.name} />,
                  sections: [
                    {
                      id: "description",
                      header: "Description",
                      content: item => (
                        <div 
                          style={{ 
                            marginTop: '20px', 
                            marginBottom: '10px',
                            fontFamily: "'Tangerine', 'Brush Script MT', cursive",
                            fontSize: '1.5rem',
                            lineHeight: '1.6',
                            color: '#333',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                            padding: '10px',
                            background: 'linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0.7))',
                            borderRadius: '8px',
                            maxHeight: '200px',
                            overflow: 'auto'
                          }}
                        >
                          <SafeHtml html={item.description} />
                        </div>
                        )
                    },
                    {
                      id: "color",
                      header: "Color",
                      content: item => <SafeHtml html={item.color} />
                    },
                    {
                      id: "price",
                      header: "Price",
                      content: item => <SafeHtml html={item.price} />
                    },
                    {
                      id: "image",
                      header: "Image",
                      content: item => (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          style={{ maxWidth: "100%", height: "auto" }}
                        />
                      )
                    }
                  ]
                }}
                cardsPerRow={[{ cards: 1 }, { minWidth: 500, cards: 2 }]}
                items={inMemoryItems}
                loadingText="Loading in-memory results..."
                trackBy="title"
                empty={
                  <Box textAlign="center" color="inherit">
                    <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                      {isLoading ? "Loading..." : "No results found."}
                    </Box>
                  </Box>
                }
              />
            </div>
          </Grid>
        </SpaceBetween>
      </Container>
    </ContentLayout>
  );
}

export default withAuthenticator(VectorSearchPage); 