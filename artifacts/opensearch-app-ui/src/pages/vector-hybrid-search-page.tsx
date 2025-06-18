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

function VectorHybridSearchPage(props: AppPage) {
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
      type: "hybrid_search",
      attribute_value: searchValue,
      attribute_name: "vector_embedding", // this fieldname is unused, we by default search on vector_embedding field
      mode: "on_disk" 
    };
    const in_memory_queryBody = {
      type: "hybrid_search",
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
          description="Search for products using hybrid search"
          actions={<Button iconName="settings" variant="icon" />}>
          Hybrid Search
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

        <ExpandableSection headerText="Guide to Hybrid Search">
          <HelpPanel
            footer={
              <div>
                <h3>
                  Learn more{" "}
                  <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li>
                    <a href="https://docs.opensearch.org/docs/latest/vector-search/ai-search/hybrid-search/index/">Link to documentation</a>
                  </li>
                </ul>
              </div>
            }
          >
            <div>
              <p>
                <b>Hybrid search</b> combines keyword and semantic search to improve search relevance.
                To implement hybrid search, you need to set up a search pipeline that runs at search time. The search pipeline intercepts search results at an intermediate stage and applies processing to normalize and combine document scores.
                In our example the user query is converted into a vector using an embedding model (Cohere embed-english-v3) on Amazon Bedrock and searched against the vector index.
                The results are then combined with the lexical search results in a post processor search pipeline.
              </p>
              <h4>Prerequisites</h4>
              <ul>
                <li>Access to Cohere embed English v3 model on Amazon Bedrock</li>
                <li>Access to Amazon Nova Lite(amazon.nova-lite-v1:0) model on Amazon Bedrock</li>
                <li><a href="#/semantic-search/vector-index">Index your documents</a> into the vector index first</li>
              </ul>
              <p>
                <b>In our example</b>, let's search for "Dark footwear for gents". The query looks as follows:
              </p>
              <pre>
                  {JSON.stringify({
                    "size": 100,
                    "_source": {
                      "excludes": "vector_embedding"
                    },
                    "query": {
                    "hybrid": {
                      "queries": [
                        {
                          "multi_match": {
                            "query": "Pink shoes for women",
                            "fields": ["title", "description"]
                          }
                        },
                        {
                          "knn": {
                            "vector_embedding": {"vector": ["0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0 ..."], "k": 100}
                          }
                        }
                      ]
                    }
                  },
                  "search_pipeline": "oss_srch_pipeline",
                  }, null, 2)}
              </pre>

              <p>Notice the <b>oss_srch_pipeline</b> in the search pipeline parameter in the query above. We created this pipeline during the indexing phase. The post processor is used to normalize and combine document scores for text and KNN searches.</p>
              <p>Below is how the post processor looks like:</p>
              <pre>
                {JSON.stringify({
                  "description": "Post processor for hybrid search",
                  "phase_results_processors": [
                    {
                      "normalization-processor": {
                        "normalization": {
                          "technique": "min_max"
                        },
                        "combination": {
                          "technique": "arithmetic_mean",
                          "parameters": {
                            "weights": [0.3, 0.7]
                          }
                        }
                      }}]

                }, null, 2)}
              </pre>
              <p>There are two kinds of processors available for Hybrid searches</p>
              <ul>
                <li><b>Normalization processor</b>: Normalizes the scores of the results from the vector search and lexical search.</li>
                <li><b>Score ranker processor</b>: A rank-based processor that uses reciprocal rank fusion algorithm to combine different query clauses to produce the final ranked list of search results.</li>
              </ul>

              <h4>Key Parameters</h4>
              <ul>
                <li><b>k</b>: Number of nearest neighbors to return (recommend starting with 100)</li>
              </ul>
              <h4>Best Practices</h4>
              <ul>
                <li>Choose the appropriate normalization technique (e.g., min_max) based on your search requirements</li>
                <li>Select a suitable combination technique (e.g., arithmetic_mean) for your use case</li>
                <li>Adjust weights in the weights array to balance the importance of different query clauses (e.g., [0.3, 0.7])</li>
                <li>Balance neural queries with traditional match or term queries based on your content</li>
                <li>Exclude large embedding fields from _source in search responses for better performance</li>
                <li>Explore pagination options like search_after for large result sets</li>
                <li>Use the hybrid search explain feature for debugging and optimization</li>
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

export default withAuthenticator(VectorHybridSearchPage); 